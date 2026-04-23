import "./styles/app.css";
import "./styles/skia-dark.css";
import { initializeMonaco } from "./editor/monacoSetup";
import { loadConfig } from "./skia/skiaConfig";
import { initializeChatPanel } from "./skia/skiaChatPanel";
import { initializeStatusBar } from "./skia/skiaStatusBar";
import { initializeOnboarding } from "./skia/skiaOnboarding";

type ViewId = "explorer" | "search" | "agent" | "forge" | "settings";

const initializeSidebarNavigation = (): void => {
  const navItems = Array.from(document.querySelectorAll<HTMLElement>("#skia-nav .nav-item"));

  const setView = (view: ViewId): void => {
    navItems.forEach((item) => {
      const itemView = item.dataset.view as ViewId | undefined;
      item.classList.toggle("is-active", itemView === view);
    });
  };

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const view = (item.dataset.view as ViewId) ?? "explorer";
      setView(view);
    });
  });

  setView("explorer");
};

const initializeHeaderActions = (): void => {
  const panelNewChat = document.getElementById("chat-new-btn");
  panelNewChat?.addEventListener("click", () => {
    panelNewChat.blur();
  });
};

const bootstrap = async (): Promise<void> => {
  await loadConfig();
  initializeMonaco();
  initializeSidebarNavigation();
  initializeHeaderActions();
  initializeChatPanel();
  initializeStatusBar();
  initializeOnboarding();
};

void bootstrap();
