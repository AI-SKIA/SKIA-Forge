import { sendChatStream } from "./skiaApiClient";
import {
    addMessage,
    clearHistory,
    getHistory,
    type SkiaMessage
} from "./skiaSessionStore";

let activeController: AbortController | null = null;
const logoSrc = "assets/sidebar-logo.png";

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

    try {
        await sendChatStream(
            { message: content },
            (chunk) => {
                assistantMessage.content += chunk;
                if (textNode) {
                    textNode.textContent = assistantMessage.content || "...";
                }
                chatMessages.scrollTop = chatMessages.scrollHeight;
            },
            activeController.signal
        );

        assistantNode.classList.remove("stream-cursor");
        addMessage(assistantMessage);
    } catch (error) {
        assistantNode.classList.remove("stream-cursor");
        if (textNode) {
            textNode.textContent =
                error instanceof Error ? `Error: ${error.message}` : "Error reaching SKIA backend.";
        }
    } finally {
        activeController = null;
    }
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