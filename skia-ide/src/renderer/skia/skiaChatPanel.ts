import { sendChatStream } from "./skiaApiClient";
import {
  addMessage,
  clearHistory,
  getActiveFile,
  getHistory,
  type SkiaMessage
} from "./skiaSessionStore";

let activeController: AbortController | null = null;

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input") as HTMLTextAreaElement | null;
const sendButton = document.getElementById("chat-send-btn");
const cancelButton = document.getElementById("chat-cancel-btn");
const clearButton = document.getElementById("chat-clear-btn");
const newChatButton = document.getElementById("chat-new-btn");
const logoSrc = "assets/skia-icon.png";

const renderMessage = (message: SkiaMessage, streaming = false): HTMLDivElement | null => {
  if (!chatMessages) {
    return null;
  }
  const node = document.createElement("div");
  node.className = `chat-message ${message.role}${streaming ? " stream-cursor" : ""}`;
  if (message.role === "assistant") {
    const prefix = document.createElement("div");
    prefix.className = "chat-prefix";
    const icon = document.createElement("img");
    icon.src = logoSrc;
    icon.alt = "SKIA";
    icon.width = 12;
    icon.height = 12;
    const label = document.createElement("span");
    label.textContent = "SKIA";
    prefix.append(icon, label);
    node.appendChild(prefix);
  }
  const text = document.createElement("div");
  text.textContent = message.content;
  node.appendChild(text);
  chatMessages.appendChild(node);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return node;
};

const renderHistory = (): void => {
  if (!chatMessages) {
    return;
  }
  chatMessages.innerHTML = "";
  getHistory().forEach((message) => renderMessage(message));
};

const send = async (): Promise<void> => {
  if (!chatInput || !chatMessages || activeController) {
    return;
  }

  const content = chatInput.value.trim();
  if (!content) {
    return;
  }

  const userMessage: SkiaMessage = { role: "user", content, timestamp: Date.now() };
  addMessage(userMessage);
  renderMessage(userMessage);
  chatInput.value = "";

  const assistantMessage: SkiaMessage = {
    role: "assistant",
    content: "",
    timestamp: Date.now()
  };
  const assistantNode = renderMessage({ ...assistantMessage, content: "..." }, true);

  activeController = new AbortController();
  try {
    await sendChatStream(
      { message: content, activeFile: getActiveFile() || null },
      (chunk) => {
        assistantMessage.content += chunk;
        if (assistantNode) {
          const textNode = assistantNode.lastElementChild as HTMLDivElement | null;
          if (textNode) {
            textNode.textContent = assistantMessage.content || "...";
          }
        }
      },
      activeController.signal
    );
    if (assistantNode) {
      assistantNode.classList.remove("stream-cursor");
    }
    addMessage(assistantMessage);
  } catch (error) {
    if (assistantNode) {
      assistantNode.classList.remove("stream-cursor");
      const textNode = assistantNode.lastElementChild as HTMLDivElement | null;
      if (textNode) {
        textNode.textContent =
          error instanceof Error ? `Streaming error: ${error.message}` : "Streaming error";
      }
    }
  } finally {
    activeController = null;
  }
};

export const initializeChatPanel = (): void => {
  renderHistory();

  sendButton?.addEventListener("click", () => {
    void send();
  });

  chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  });

  cancelButton?.addEventListener("click", () => {
    activeController?.abort();
    activeController = null;
  });

  clearButton?.addEventListener("click", () => {
    clearHistory();
    renderHistory();
  });
  newChatButton?.addEventListener("click", () => {
    clearHistory();
    renderHistory();
  });

};
