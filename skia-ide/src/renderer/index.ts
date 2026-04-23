import "./styles/app.css";
import "./skia-dark.css";
import { initializeMonaco } from "./editor/monacoSetup";
import { loadConfig } from "./skia/skiaConfig";
import { initializeChatPanel } from "./skia/skiaChatPanel";
import { initializeStatusBar } from "./skia/skiaStatusBar";
import { initializeOnboarding } from "./skia/skiaOnboarding";

type ViewId = "explorer" | "search" | "agent" | "forge" | "settings";

const initializeWorkbenchViews = (): void => {
  const navItems = Array.from(document.querySelectorAll<HTMLElement>("#skia-nav .nav-item"));
  const activityItems = Array.from(document.querySelectorAll<HTMLButtonElement>(".activity-btn"));

  const dashboardView = document.getElementById("dashboard-view");
  const settingsView = document.getElementById("settings-view");
  const centerPanel = document.getElementById("center-panel");

  const setView = (view: ViewId): void => {
    // Highlight activity bar buttons
    activityItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.view === view);
    });

    // Highlight sidebar nav items
    navItems.forEach((item) => {
      const itemView = item.dataset.view as ViewId | undefined;
      item.classList.toggle("is-active", itemView === view);
    });

    const showDashboard = view === "forge";
    const showSettings = view === "settings";
    const showWorkbench = !showDashboard && !showSettings;

    // Toggle main workbench grid vs dashboard/settings
    dashboardView?.classList.toggle("hidden", !showDashboard);
    settingsView?.classList.toggle("hidden", !showSettings);
    centerPanel?.classList.toggle("hidden", !showWorkbench);
  };

  // Wire activity bar
  activityItems.forEach((item) => {
    item.addEventListener("click", () => {
      const view = (item.dataset.view as ViewId) ?? "explorer";
      setView(view);
    });
  });

  // Wire sidebar nav
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const view = (item.dataset.view as ViewId) ?? "explorer";
      setView(view);
    });
  });

  // Default view
  setView("explorer");
};

const applySkiaContainerClasses = (): void => {
  document.getElementById("sidebar")?.classList.add("skia-sidebar");
  document.getElementById("top-bar")?.classList.add("skia-header");
  document.getElementById("editor-container")?.classList.add("skia-editor");
  document.getElementById("status-bar")?.classList.add("skia-statusbar");
};

const initializeHeaderActions = (): void => {
  const headerNewChat = document.getElementById("header-new-chat-btn");
  const panelNewChat = document.getElementById("chat-new-btn");
  headerNewChat?.addEventListener("click", () => {
    panelNewChat?.dispatchEvent(new MouseEvent("click"));
  });
};

const bootstrap = async (): Promise<void> => {
  await loadConfig();
  applySkiaContainerClasses();
  initializeMonaco();
  initializeWorkbenchViews();
  initializeHeaderActions();
  initializeChatPanel();
  initializeStatusBar();
  initializeOnboarding();
};

void bootstrap();

const initSplitters = (): void => {
  const v1 = document.getElementById("splitter-vertical")!;
  const v2 = document.getElementById("splitter-chat")!;
  const h1 = document.getElementById("splitter-horizontal")!;

  const shell = document.querySelector(".skia-editor-shell") as HTMLElement;

  let dragging: HTMLElement | null = null;

  const startDrag = (_e: MouseEvent, splitter: HTMLElement) => {
    dragging = splitter;
    document.body.classList.add("resizing");
  };

  const stopDrag = () => {
    dragging = null;
    document.body.classList.remove("resizing");
  };

  const onDrag = (e: MouseEvent) => {
    if (!dragging) return;

    const rect = shell.getBoundingClientRect();

    if (dragging.id === "splitter-vertical") {
      const width = Math.max(180, e.clientX - rect.left);
      shell.style.gridTemplateColumns = `${width}px 6px 1fr 6px 380px`;
    }

    if (dragging.id === "splitter-chat") {
      const width = Math.max(260, rect.right - e.clientX);
      shell.style.gridTemplateColumns = `260px 6px 1fr 6px ${width}px`;
    }

    if (dragging.id === "splitter-horizontal") {
      const height = Math.max(120, rect.bottom - e.clientY);
      shell.style.gridTemplateRows = `1fr 6px ${height}px`;
    }
  };

  [v1, v2, h1].forEach((splitter) => {
    splitter.addEventListener("mousedown", (e) => startDrag(e, splitter));
  });

  window.addEventListener("mouseup", stopDrag);
  window.addEventListener("mousemove", onDrag);
};

initSplitters();
