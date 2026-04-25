import { runSkiaReview, sendChatStream, sendSseChatStream } from "./skiaApiClient";
import {
    addMessage,
    clearHistory,
    getHistory,
    type SkiaMessage
} from "./skiaSessionStore";

let activeController: AbortController | null = null;
const logoSrc = "assets/sidebar-logo.png";
type StreamFrameType =
    | "section_start"
    | "content"
    | "section_end"
    | "quality_score"
    | "correction"
    | "verification_log";
type StreamFrame = { type: StreamFrameType; payload: string };

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

    const text = document.createElement("div");
    text.className = "chat-message-text";
    text.textContent = message.content;
    node.appendChild(text);
    chatMessages.appendChild(node);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return node;
};

const renderHistory = (chatMessages: HTMLElement): void => {
    chatMessages.innerHTML = "";
    getHistory().forEach((message) => renderMessage(chatMessages, message));
};

const send = async (
    chatMessages: HTMLElement,
    chatInput: HTMLTextAreaElement
): Promise<void> => {
    if (activeController) return;

    const content = chatInput.value.trim();
    if (!content) return;

    const userMessage: SkiaMessage = { role: "user", content, timestamp: Date.now() };
    addMessage(userMessage);
    renderMessage(chatMessages, userMessage);
    chatInput.value = "";

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
            await sendSseChatStream(
                { message: content, qualityThreshold: 0.8, maxOutputTokens: 4096 },
                (frameRaw) => {
                    const frame = parseFrame(frameRaw);
                    if (!frame) return;
                    applyStreamFrame(frame, assistantMessage, textNode, logBody);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                },
                activeController.signal
            );
        }

        assistantNode.classList.remove("stream-cursor");
        addMessage(assistantMessage);
    } catch (error) {
        // Fallback path for environments that still use non-SSE response shapes.
        try {
            await sendChatStream(
                { message: content },
                (chunk) => {
                    assistantMessage.content += chunk;
                    if (textNode) textNode.textContent = assistantMessage.content || "...";
                },
                activeController.signal || undefined
            );
            addMessage(assistantMessage);
        } catch {
            assistantNode.classList.remove("stream-cursor");
            if (textNode) {
                textNode.textContent =
                    error instanceof Error ? `Error: ${error.message}` : "Error reaching SKIA backend.";
            }
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
    // ALL DOM queries happen here, after DOM is ready
    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input") as HTMLTextAreaElement | null;
    const sendButton = document.getElementById("chat-send-btn");
    const cancelButton = document.getElementById("chat-cancel-btn");
    const clearButton = document.getElementById("chat-clear-btn");
    const newChatButton = document.getElementById("chat-new-btn");

    if (!chatMessages || !chatInput) {
        console.error("SKIA: Chat panel DOM elements not found");
        return;
    }

    renderHistory(chatMessages);

    sendButton?.addEventListener("click", () => {
        void send(chatMessages, chatInput);
    });

    chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send(chatMessages, chatInput);
        }
    });

    cancelButton?.addEventListener("click", () => {
        activeController?.abort();
        activeController = null;
    });

    clearButton?.addEventListener("click", () => {
        clearHistory();
        renderHistory(chatMessages);
    });

    newChatButton?.addEventListener("click", () => {
        clearHistory();
        renderHistory(chatMessages);
    });
};