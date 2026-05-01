import { runSkiaReview } from "./skiaApiClient";
import { getAuthToken, getLoggedInUser, isAuthenticated, logout } from "./skiaAuthPanel";
import { getChatPipelineUrl } from "./skiaConfig";
import { applyIdeBrainToMessagesPayload } from "./skiaIdeBrainContext";
import {
    addMessage,
    clearHistory,
    getHistory,
    type SkiaMessage
} from "./skiaSessionStore";

let activeController: AbortController | null = null;
/** Files queued for the next send (same behavior as main-site chat). */
let pendingChatAttachments: File[] = [];

const logoSrc = "assets/sidebar-logo.png";

type StreamFrameType =
    | "section_start"
    | "content"
    | "section_end"
    | "quality_score"
    | "correction"
    | "verification_log";
type StreamFrame = { type: StreamFrameType; payload: string };

function downloadSkiaOutputAsFile(text: string, baseName: string): void {
    const safeBase = (baseName || "skia-output").replace(/[^\w\-]+/g, "-").slice(0, 80) || "skia-output";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeBase}-skia-revision.txt`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function attachAssistantDownloadButton(
    assistantNode: HTMLDivElement,
    content: string,
    baseName: string,
): void {
    if (assistantNode.querySelector("[data-skia-download]")) return;
    const dl = document.createElement("button");
    dl.type = "button";
    dl.dataset.skiaDownload = "1";
    dl.textContent = "DOWNLOAD";
    dl.title = "Download SKIA's reply as a text file";
    dl.style.marginTop = "8px";
    dl.style.background = "rgba(212,175,55,0.1)";
    dl.style.border = "1px solid rgba(212,175,55,0.35)";
    dl.style.color = "#d4af37";
    dl.style.borderRadius = "0";
    dl.style.padding = "4px 10px";
    dl.style.cursor = "pointer";
    dl.style.fontSize = "10px";
    dl.style.textTransform = "uppercase";
    dl.style.letterSpacing = "0.08em";
    dl.addEventListener("click", () => downloadSkiaOutputAsFile(content, baseName));
    assistantNode.appendChild(dl);
}

const renderMessage = (
    chatMessages: HTMLElement,
    message: SkiaMessage,
    streaming = false
): HTMLDivElement => {
    const node = document.createElement("div");
    node.className = `chat-message ${message.role}${streaming ? " stream-cursor" : ""}`;

    if (message.role === "assistant") {
        const prefix = document.createElement("div");
        prefix.className = "chat-prefix";
        const icon = document.createElement("img");
        icon.src = logoSrc;
        icon.alt = "SKIA";
        icon.width = 16;
        icon.height = 16;
        const label = document.createElement("span");
        label.textContent = "SKIA";
        prefix.append(icon, label);
        node.appendChild(prefix);
    }

    if (message.role === "user" && message.files?.length) {
        const chips = document.createElement("div");
        chips.style.display = "flex";
        chips.style.flexWrap = "wrap";
        chips.style.gap = "6px";
        chips.style.marginBottom = "6px";
        chips.style.justifyContent = "flex-end";
        for (const fname of message.files) {
            const s = document.createElement("span");
            s.textContent = `\u{1F4CE} ${fname}`;
            s.style.fontSize = "10px";
            s.style.padding = "3px 8px";
            s.style.borderRadius = "4px";
            s.style.background = "rgba(212,175,55,0.12)";
            s.style.border = "1px solid rgba(212,175,55,0.25)";
            s.style.color = "rgba(212,175,55,0.85)";
            chips.appendChild(s);
        }
        node.appendChild(chips);
    }

    const text = document.createElement("div");
    text.className = "chat-message-text";
    text.textContent = message.content;
    node.appendChild(text);

    if (message.role === "assistant" && message.downloadBaseName && !streaming) {
        attachAssistantDownloadButton(node, message.content, message.downloadBaseName);
    }

    chatMessages.appendChild(node);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return node;
};

const renderHistory = (chatMessages: HTMLElement): void => {
    chatMessages.innerHTML = "";
    getHistory().forEach((message) => renderMessage(chatMessages, message));
};

function syncAttachmentUi(fileInput: HTMLInputElement | null, attachBtn: HTMLButtonElement | null): void {
    const n = pendingChatAttachments.length;
    if (attachBtn) {
        attachBtn.textContent = n > 0 ? `ATTACH (${n})` : "ATTACH";
        attachBtn.classList.toggle("chat-attach--queued", n > 0);
        attachBtn.title =
            n > 0 ? `${n} file(s) queued — click to add more (or drop files here)` : "Attach documents for SKIA";
        attachBtn.setAttribute("aria-label", n > 0 ? `${n} files attached` : "Attach files");
    }
    if (fileInput) fileInput.value = "";
}

const send = async (
    chatMessages: HTMLElement,
    chatInput: HTMLTextAreaElement,
    fileInput: HTMLInputElement | null,
    attachBtn: HTMLButtonElement | null
): Promise<void> => {
    if (activeController) return;

    const content = chatInput.value.trim();
    if (!content) return;
    if (!isAuthenticated()) {
        renderMessage(chatMessages, {
            role: "assistant",
            content: "Please sign in to use SKIA",
            timestamp: Date.now()
        });
        return;
    }
    const token = getAuthToken();
    if (!token) {
        renderMessage(chatMessages, {
            role: "assistant",
            content: "Please sign in to use SKIA",
            timestamp: Date.now()
        });
        return;
    }

    const filesToSend = [...pendingChatAttachments];
    const attachmentNames = filesToSend.map((f) => f.name);
    const uploadDownloadBase = filesToSend[0]?.name?.replace(/\.[^/.]+$/, "") || "";

    const userMessage: SkiaMessage = {
        role: "user",
        content,
        timestamp: Date.now(),
        ...(attachmentNames.length > 0 ? { files: attachmentNames } : {})
    };
    addMessage(userMessage);
    renderMessage(chatMessages, userMessage);
    chatInput.value = "";
    pendingChatAttachments = [];
    syncAttachmentUi(fileInput, attachBtn);

    const assistantMessage: SkiaMessage = {
        role: "assistant",
        content: "",
        timestamp: Date.now()
    };

    const assistantNode = renderMessage(chatMessages, { ...assistantMessage, content: "..." }, true);
    const textNode = assistantNode.querySelector(".chat-message-text") as HTMLDivElement | null;

    activeController = new AbortController();
    const verificationPanel = document.createElement("details");
    verificationPanel.style.marginTop = "8px";
    verificationPanel.style.border = "1px solid #5f4f1f";
    verificationPanel.style.padding = "6px";
    const summary = document.createElement("summary");
    summary.textContent = "Verification Log";
    verificationPanel.appendChild(summary);
    const logBody = document.createElement("pre");
    logBody.style.whiteSpace = "pre-wrap";
    logBody.style.margin = "6px 0 0";
    verificationPanel.appendChild(logBody);
    assistantNode.appendChild(verificationPanel);

    try {
        if (content.startsWith("/skia-review")) {
            const reviewPayload = content.replace("/skia-review", "").trim() || "Run full SKIA review.";
            const review = await runSkiaReview({ message: reviewPayload });
            assistantMessage.content = JSON.stringify(review, null, 2);
            if (textNode) textNode.textContent = assistantMessage.content;
        } else {
            const user = getLoggedInUser();
            const rawMessages = getHistory()
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => ({ role: m.role, content: m.content }));
            const messagesPayload = await applyIdeBrainToMessagesPayload(rawMessages);
            const formData = new FormData();
            formData.append("messages", JSON.stringify(messagesPayload));
            formData.append("is_guest", "false");
            formData.append("style", "Sovereign");
            formData.append("includeReasoning", "false");
            formData.append("responseDepth", "Balanced");
            formData.append("mode", "agent");
            formData.append("source", "skia-forge-ide");
            if (user?.email) formData.append("user_email", user.email);
            for (const f of filesToSend) {
                formData.append("files", f);
            }

            const pipelineUrl = getChatPipelineUrl();
            const response = await fetch(pipelineUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "x-skia-client": "forge-desktop"
                },
                body: formData,
                signal: activeController.signal
            });

            if (response.status === 401) {
                logout();
                throw new Error("Your session wrapped up while you were away. Log back in and we'll pick up instantly.");
            }
            if (response.status === 403) {
                let detail = "";
                try {
                    const payload = (await response.json()) as Record<string, unknown>;
                    detail = String(payload?.error || payload?.message || "");
                } catch {
                    try {
                        detail = await response.text();
                    } catch {
                        detail = "";
                    }
                }
                throw new Error(
                    detail ||
                        "Quick heads-up — your 10-day window to verify your email ran out.\nNo worries — you didn't break anything.\n\nTo keep chatting with me, just verify your email.\n\nTakes about 10 seconds and you're right back in.\nI'll be waiting on the other side.",
                );
            }
            if (!response.ok) {
                if (response.status === 402) {
                    throw new Error("You've hit zero credits. Add more anytime and SKIA will keep going.");
                }
                if (response.status === 429) {
                    throw new Error(
                        "You're moving fast - faster than the system can keep up. Give it a moment and try again.",
                    );
                }
                if (response.status === 500) {
                    throw new Error("SKIA stumbled on something unexpected. A quick retry should clear it.");
                }
                if (response.status === 503) {
                    throw new Error(
                        "Alright, tiny hiccup on my end.\nSKIA's systems are doing a quick reset.\n\nNothing you did — just routine chaos behind the scenes.\nGive me a moment and I'll be back online.",
                    );
                }
                throw new Error(`Server returned ${response.status}`);
            }

            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("text/event-stream") && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf8");
                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const frames = buffer.split("\n\n");
                    buffer = frames.pop() ?? "";
                    for (const chunk of frames) {
                        const line = chunk
                            .split("\n")
                            .find((entry) => entry.startsWith("data: "));
                        if (!line) continue;
                        const frame = parseFrame(line.slice("data: ".length));
                        if (frame) {
                            applyStreamFrame(frame, assistantMessage, textNode, logBody);
                        } else {
                            assistantMessage.content += line.slice("data: ".length);
                            if (textNode) textNode.textContent = assistantMessage.content || "...";
                        }
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }
            } else {
                const data = (await response.json()) as Record<string, unknown>;
                const reply = typeof data.response === "string" ? data.response : "";
                assistantMessage.content = reply || "SKIA couldn't generate a reply this time. One more try should do it.";
                if (textNode) textNode.textContent = assistantMessage.content;
            }

            if (uploadDownloadBase && filesToSend.length > 0) {
                assistantMessage.downloadBaseName = uploadDownloadBase;
                attachAssistantDownloadButton(assistantNode, assistantMessage.content, uploadDownloadBase);
            }
        }

        assistantNode.classList.remove("stream-cursor");
        addMessage(assistantMessage);
    } catch (error) {
        assistantNode.classList.remove("stream-cursor");
        if (textNode) {
            const message = error instanceof Error ? String(error.message || "") : "";
            const isAbort = (error as { name?: string } | null)?.name === "AbortError" || message.includes("AbortError");
            const userFacing =
                message.includes("401")
                    ? "Your session wrapped up while you were away. Log back in and we'll pick up instantly."
                    : message.includes("402")
                        ? "You've hit zero credits. Add more anytime and SKIA will keep going."
                        : message.includes("429")
                            ? "You're moving fast - faster than the system can keep up. Give it a moment and try again."
                            : message.includes("500")
                                ? "SKIA stumbled on something unexpected. A quick retry should clear it."
                                : message.includes("503")
                                    ? "Alright, tiny hiccup on my end.\nSKIA's systems are doing a quick reset.\n\nNothing you did — just routine chaos behind the scenes.\nGive me a moment and I'll be back online."
                                    : isAbort
                                        ? "SKIA took too long to respond this time. Try again and we'll get it through."
                                        : /^Server returned \d{3}$/.test(message)
                                            ? "The connection dropped on the way here. Check your network or try again in a moment."
                                        : message
                                            ? message
                                            : "The connection dropped on the way here. Check your network or try again in a moment.";
            textNode.textContent = userFacing;
        }
    } finally {
        assistantNode.classList.remove("stream-cursor");
        activeController = null;
    }
};

const parseFrame = (frameRaw: string): StreamFrame | null => {
    try {
        const parsed = JSON.parse(frameRaw) as Partial<StreamFrame>;
        if (!parsed || typeof parsed.type !== "string" || typeof parsed.payload !== "string") return null;
        return parsed as StreamFrame;
    } catch {
        return null;
    }
};

const applyStreamFrame = (
    frame: StreamFrame,
    assistantMessage: SkiaMessage,
    textNode: HTMLDivElement | null,
    verificationBody: HTMLPreElement
): void => {
    switch (frame.type) {
        case "section_start":
            assistantMessage.content += `\n\n## ${frame.payload}\n`;
            break;
        case "content":
            assistantMessage.content += frame.payload;
            break;
        case "section_end":
            assistantMessage.content += `\n\n-- ${frame.payload} complete --\n`;
            break;
        case "quality_score":
            verificationBody.textContent += `\n[quality_score]\n${frame.payload}\n`;
            break;
        case "verification_log":
            verificationBody.textContent += `\n[verification_log]\n${frame.payload}\n`;
            break;
        case "correction":
            assistantMessage.content += `\n\`\`\`diff\n- pending output segment\n+ ${frame.payload}\n\`\`\`\n`;
            verificationBody.textContent += `\n[correction]\n${frame.payload}\n`;
            break;
    }
    if (textNode) textNode.textContent = assistantMessage.content || "...";
};

export const initializeChatPanel = (): void => {
    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input") as HTMLTextAreaElement | null;
    const sendButton = document.getElementById("chat-send-btn");
    const cancelButton = document.getElementById("chat-cancel-btn");
    const clearButton = document.getElementById("chat-clear-btn");
    const newChatButton = document.getElementById("chat-new-btn");
    const fileInput = document.getElementById("chat-file-input") as HTMLInputElement | null;
    const attachButton = document.getElementById("chat-attach-btn") as HTMLButtonElement | null;
    const chatControls = document.getElementById("chat-controls");

    if (!chatMessages || !chatInput) {
        console.error("SKIA: Chat panel DOM elements not found");
        return;
    }

    renderHistory(chatMessages);
    syncAttachmentUi(fileInput, attachButton);

    attachButton?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", () => {
        const list = fileInput.files;
        if (list?.length) {
            pendingChatAttachments = [...pendingChatAttachments, ...Array.from(list)];
        }
        syncAttachmentUi(fileInput, attachButton);
    });

    chatControls?.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    chatControls?.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dt = e.dataTransfer?.files;
        if (dt?.length) {
            pendingChatAttachments = [...pendingChatAttachments, ...Array.from(dt)];
            syncAttachmentUi(fileInput, attachButton);
        }
    });

    sendButton?.addEventListener("click", () => {
        void send(chatMessages, chatInput, fileInput, attachButton);
    });

    chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send(chatMessages, chatInput, fileInput, attachButton);
        }
    });

    cancelButton?.addEventListener("click", () => {
        activeController?.abort();
        activeController = null;
    });

    clearButton?.addEventListener("click", () => {
        clearHistory();
        pendingChatAttachments = [];
        syncAttachmentUi(fileInput, attachButton);
        renderHistory(chatMessages);
    });

    newChatButton?.addEventListener("click", () => {
        clearHistory();
        pendingChatAttachments = [];
        syncAttachmentUi(fileInput, attachButton);
        renderHistory(chatMessages);
    });
};
