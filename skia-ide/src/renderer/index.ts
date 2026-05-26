import "./styles/app.css";
import "./styles/skia-dark.css";
import { applyForgeUiStrings, populateSettingsLocaleSelect } from "./i18n/applyForgeUi";
import { getLocale, initForgeI18n, subscribeLocaleChange } from "./i18n/forgeI18n";
import { getEditor, initializeMonaco } from "./editor/monacoSetup";
import { loadConfig, getBackendUrl, getLocalBackendMode, getLocalEngineConfig, getLocalFounderOverride, getSkiaOwnerEmail } from "./skia/skiaConfig";
import { initializeLocalHealthPanel } from "./skia/localHealthPanel";
import { initializeChatPanel } from "./skia/skiaChatPanel";
import { cancelAgentTask, initializeAgentPanel } from "./skia/skiaAgentPanel";
import { initializeStatusBar } from "./skia/skiaStatusBar";
import { initializeOnboarding } from "./skia/skiaOnboarding";
import { initializeAuthPanel, isAuthenticated, logout } from "./skia/skiaAuthPanel";
import { setActiveFile, setWorkspacePath } from "./skia/skiaSessionStore";
import {
    appendSystemTerminalLine,
    ensureTerminalPanelVisible,
    initSkiaTerminalPanel
} from "./skia/skiaTerminalPanel";
import {
    getContext,
    getMode,
    getGovernance,
    getModulesStatus,
    SkiaOfflineError,
} from "./skia/skiaApiClient";

const SETTINGS_STORAGE_KEY = "skia_editor_settings";

const loadEditorSettings = (): {
    fontSize: number;
    minimap: boolean;
    wordWrap: string;
    tabSize: number;
    autoSave: boolean;
} => {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
            return { fontSize: 13, minimap: true, wordWrap: "off", tabSize: 4, autoSave: false, ...JSON.parse(raw) };
        }
    } catch { /* ignore */ }
    return { fontSize: 13, minimap: true, wordWrap: "off", tabSize: 4, autoSave: false };
};

const saveEditorSettings = (): void => {
    const editor = getEditor() as {
        getRawOptions?: () => Record<string, unknown>;
    } | null;
    if (!editor?.getRawOptions) return;
    const opts = editor.getRawOptions();
    localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
            fontSize: opts.fontSize ?? 13,
            minimap: (opts.minimap as { enabled?: boolean } | undefined)?.enabled ?? true,
            wordWrap: opts.wordWrap ?? "off",
            tabSize: opts.tabSize ?? 4,
            autoSave: autoSaveEnabled,
        })
    );
};

const refreshLocalHealthPanel = async (): Promise<void> => {
    const engines = getLocalEngineConfig();
    await initializeLocalHealthPanel({
        backendUrl: getBackendUrl(),
        skiaServeUrl: engines.skiaServeUrl,
        embeddingEngineUrl: engines.embeddingEngineUrl,
        vectorDbUrl: engines.vectorDbUrl,
        videoServiceUrl: engines.videoServiceUrl,
        comfyuiUrl: engines.comfyuiUrl,
        sdWebuiUrl: engines.sdWebuiUrl,
        localMode: getLocalBackendMode(),
        founderOverride: getLocalFounderOverride(),
        founderEmail: getSkiaOwnerEmail(),
    });
};

const viewMap: Record<string, string> = {
    explorer: "editor-container",
    search: "view-search",
    agent: "view-agent",
    forge: "view-forge",
    "local-health": "view-local-health",
    settings: "view-settings"
};

let navItems: HTMLElement[] = [];
let activeView = "explorer";
let activeFilePath = "";
let activeFolderPath = "";
let menuListenersRegistered = false;
let autoSaveEnabled = false;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let settingsControlsInitialized = false;

type UpdateInstallBridge = {
    downloadAndInstall: (downloadUrl: string) => Promise<void>;
    onUpdateDownloadProgress: (listener: (data: { percent: number }) => void) => void;
    onUpdateDownloadError: (listener: (data: { message: string }) => void) => void;
};

const updateInstallApi = (): typeof window.skiaElectron & UpdateInstallBridge =>
    window.skiaElectron as typeof window.skiaElectron & UpdateInstallBridge;

const wireInAppUpdateAction = (host: HTMLDivElement, downloadUrl: string): void => {
    const actions = host.querySelector("#skia-update-actions");
    const actionBtn = host.querySelector("#skia-update-action") as HTMLButtonElement | null;
    if (!actions || !actionBtn) return;

    const startDownload = (): void => {
        const api = updateInstallApi();
        actions.innerHTML = `
      <div style="margin-top:10px;">
        <div id="skia-update-bar-bg" style="height:8px;background:rgba(255,255,255,0.12);border-radius:4px;overflow:hidden;">
          <div id="skia-update-bar-fill" style="height:100%;width:0%;background:#d4af37;transition:width 0.12s ease;"></div>
        </div>
        <div id="skia-update-status" style="margin-top:8px;font-size:12px;font-weight:400;color:rgba(255,255,255,0.55);">Downloading…</div>
      </div>`;
        const fill = actions.querySelector("#skia-update-bar-fill") as HTMLDivElement | null;
        const statusEl = actions.querySelector("#skia-update-status") as HTMLDivElement | null;

        api.onUpdateDownloadProgress((d) => {
            if (fill) fill.style.width = `${d.percent}%`;
            if (d.percent >= 100 && statusEl) {
                statusEl.textContent = "Installing…";
            }
        });

        api.onUpdateDownloadError((err) => {
            actions.innerHTML = "";
            const msg = document.createElement("div");
            msg.style.marginTop = "10px";
            msg.style.fontSize = "11px";
            msg.style.color = "#ff5c5c";
            msg.textContent = err.message;
            actions.appendChild(msg);
            const retry = document.createElement("button");
            retry.type = "button";
            retry.id = "skia-update-retry";
            retry.textContent = "Retry";
            retry.style.marginTop = "8px";
            retry.style.background = "transparent";
            retry.style.border = "1px solid rgba(212,175,55,0.5)";
            retry.style.color = "#d4af37";
            retry.style.padding = "6px 10px";
            retry.style.cursor = "pointer";
            retry.style.fontSize = "10px";
            retry.addEventListener("click", () => startDownload());
            actions.appendChild(retry);
        });

        void api.downloadAndInstall(downloadUrl).catch(() => {
            /* terminal errors arrive via update-download-error */
        });
    };

    actionBtn.addEventListener("click", () => {
        startDownload();
    });
};

const showUpdateNotice = (title: string, message: string, actionLabel?: string, actionUrl?: string): void => {
    let host = document.getElementById("skia-update-notice") as HTMLDivElement | null;
    if (!host) {
        host = document.createElement("div");
        host.id = "skia-update-notice";
        host.style.position = "fixed";
        host.style.right = "14px";
        host.style.bottom = "34px";
        host.style.zIndex = "9999";
        host.style.maxWidth = "360px";
        host.style.background = "rgba(12, 12, 12, 0.96)";
        host.style.border = "1px solid rgba(212,175,55,0.45)";
        host.style.borderRadius = "10px";
        host.style.padding = "12px";
        host.style.color = "#ffffff";
        host.style.boxShadow = "0 8px 24px rgba(0,0,0,0.45)";
        document.body.appendChild(host);
    }
    const actionBlock =
        actionLabel && actionUrl
            ? `<div id="skia-update-actions" style="margin-top:10px;">
      <button type="button" id="skia-update-action" style="background:transparent;border:1px solid rgba(212,175,55,0.5);color:#d4af37;padding:8px 10px;cursor:pointer;">${actionLabel}</button>
    </div>`
            : "";
    host.innerHTML = `
      <div style="font-size:10px;font-weight: 400;letter-spacing:0.08em;color:#d4af37;text-transform:uppercase;margin-bottom:6px;">${title}</div>
      <div style="font-size:14px;font-weight:400;line-height:1.5;color:#ffffff;">${message}</div>
      ${actionBlock}
      <button id="skia-update-dismiss" style="margin-top:10px;margin-left:8px;background:transparent;border:1px solid rgba(255,255,255,0.22);color:rgba(255,255,255,0.72);padding:8px 10px;cursor:pointer;">Dismiss</button>
    `;
    const dismissBtn = document.getElementById("skia-update-dismiss") as HTMLButtonElement | null;
    dismissBtn?.addEventListener("click", () => {
        host?.remove();
    });
    if (actionLabel && actionUrl) {
        wireInAppUpdateAction(host, actionUrl);
    }
};

/** Register before bootstrap so startup update checks are not missed (main emits on did-finish-load). */
const initializeAutoUpdateListener = (): void => {
    window.skiaElectron.onUpdateStatus((payload) => {
        if (payload.status === "update-available" && payload.latestVersion && payload.downloadUrl) {
            showUpdateNotice(
                "Update Available",
                `Version ${payload.latestVersion} is available. Download and install the latest SKIA FORGE build.`,
                "Update Now",
                payload.downloadUrl
            );
            return;
        }
        if (payload.status === "error" && payload.message) {
            // Keep this silent unless user triggered manual check.
            return;
        }
    });
    window.skiaElectron.notifyRendererReady();
};

const getLanguageFromPath = (filePath: string): string => {
    const normalized = filePath.toLowerCase();
    if (normalized.endsWith(".ts") || normalized.endsWith(".tsx")) return "typescript";
    if (normalized.endsWith(".js") || normalized.endsWith(".jsx")) return "javascript";
    if (normalized.endsWith(".json")) return "json";
    if (normalized.endsWith(".md")) return "markdown";
    if (normalized.endsWith(".css")) return "css";
    if (normalized.endsWith(".html")) return "html";
    if (normalized.endsWith(".py")) return "python";
    return "plaintext";
};

const getFileName = (filePath: string): string => {
    const normalized = filePath.replace(/\\/g, "/");
    return normalized.split("/").pop() ?? filePath;
};

const setStatus = (text: string): void => {
    const statusEl = document.getElementById("status-text");
    if (statusEl) statusEl.textContent = text;
};

const showExplorerEmptyState = (): void => {
    const empty = document.getElementById("explorer-empty-state");
    const content = document.getElementById("explorer-tree-content");
    if (empty) empty.style.display = "";
    if (content) {
        content.style.display = "none";
        content.innerHTML = "";
    }
};

const getExplorerTreeContent = (): HTMLDivElement | null =>
    document.getElementById("explorer-tree-content") as HTMLDivElement | null;

const renderForgeError = (message: string): void => {
    const el = document.getElementById("forge-mode");
    const govEl = document.getElementById("forge-governance");
    const modEl = document.getElementById("forge-modules");

    if (govEl) govEl.innerHTML = "";
    if (modEl) modEl.innerHTML = "";
    if (!el) return;
    el.innerHTML = `
        <div class="forge-offline-notice">
            <span class="forge-offline-title">${message}</span>
            <button id="forge-retry-btn">RETRY</button>
        </div>`;
    document.getElementById("forge-retry-btn")?.addEventListener("click", () => loadForgeStatus(), { once: true });
};

const loadForgeStatus = async (): Promise<void> => {
    const modeEl = document.getElementById("forge-mode");
    const govEl = document.getElementById("forge-governance");
    const modEl = document.getElementById("forge-modules");

    if (modeEl) modeEl.innerHTML = `<div class="forge-offline-notice"><span class="forge-offline-title">Loading...</span></div>`;
    if (govEl) govEl.textContent = "";
    if (modEl) modEl.textContent = "";

    try {
        const [mode, gov, modules] = await Promise.all([
            getMode(),
            getGovernance(),
            getModulesStatus()
        ]);

        if (!mode && !gov && !modules) {
            renderForgeError("Cannot reach backend. Check your connection.");
            return;
        }
        if (!mode || !gov || !modules) {
            renderForgeError("Control plane returned an unexpected error.");
            return;
        }

        if (modeEl) {
            modeEl.innerHTML = `
                <div class="forge-row">
                    <span class="forge-label">MODE</span>
                    <span class="forge-value">${String(mode.mode ?? mode.currentMode ?? "sovereign")}</span>
                </div>`;
        }
        if (govEl) {
            govEl.innerHTML = `
                <div class="forge-row">
                    <span class="forge-label">GOVERNANCE</span>
                    <span class="forge-value">${JSON.stringify(gov, null, 2)}</span>
                </div>`;
        }
        if (modEl) {
            modEl.innerHTML = `
                <div class="forge-row">
                    <span class="forge-label">MODULES</span>
                    <span class="forge-value">${JSON.stringify(modules, null, 2)}</span>
                </div>`;
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (error instanceof SkiaOfflineError) {
            renderForgeError("Cannot reach backend. Check your connection.");
            return;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
            renderForgeError("Cannot reach backend. Check your connection.");
            return;
        }
        if (/\(401\)/.test(msg) || /\(403\)/.test(msg)) {
            renderForgeError("Authentication required. Sign in and try again.");
            return;
        }
        if (/\(404\)/.test(msg)) {
            renderForgeError("Control plane not available on this host.");
            return;
        }
        if (msg === "Failed to fetch" || error instanceof TypeError) {
            renderForgeError("Cannot reach backend. Check your connection.");
            return;
        }
        renderForgeError("Control plane returned an unexpected error.");
    }
};

const syncSettingsConnectionStatus = (): void => {
    const connEl = document.getElementById("connection-status-display");
    if (connEl) {
        const statusText = document.getElementById("status-text")?.textContent ?? "";
        connEl.textContent = statusText.replace("⬡ ", "").replace("◈ ", "");
    }
};

const refreshSettingsDisplay = (): void => {
    syncSettingsConnectionStatus();

    const editor = getEditor() as unknown as {
        updateOptions?: (opts: Record<string, unknown>) => void;
        getRawOptions?: () => Record<string, unknown>;
    } | null;
    const rawOptions = typeof editor?.getRawOptions === "function" ? editor.getRawOptions() : {};
    const fontSize = Number(rawOptions?.fontSize ?? 13);
    const minimapEnabled = Boolean((rawOptions?.minimap as { enabled?: boolean } | undefined)?.enabled ?? true);
    const wordWrapOn = String(rawOptions?.wordWrap ?? "off") === "on";
    const tabSize = Number(rawOptions?.tabSize ?? 4);

    const fontDisplay = document.getElementById("font-size-display");
    const minimapBtn = document.getElementById("toggle-minimap") as HTMLButtonElement | null;
    const wrapBtn = document.getElementById("toggle-wordwrap") as HTMLButtonElement | null;
    const tabSelect = document.getElementById("tab-size-select") as HTMLSelectElement | null;
    const autoSaveBtn = document.getElementById("toggle-autosave") as HTMLButtonElement | null;

    if (fontDisplay) fontDisplay.textContent = `${fontSize}px`;
    if (minimapBtn) minimapBtn.textContent = minimapEnabled ? "ON" : "OFF";
    if (wrapBtn) wrapBtn.textContent = wordWrapOn ? "ON" : "OFF";
    if (tabSelect) tabSelect.value = String(tabSize);
    if (autoSaveBtn) autoSaveBtn.textContent = autoSaveEnabled ? "ON" : "OFF";
};

const initializeSettingsControlsOnce = (): void => {
    if (settingsControlsInitialized) {
        return;
    }
    settingsControlsInitialized = true;

    const verEl = document.getElementById("settings-app-version");
    if (verEl) verEl.textContent = window.skiaElectron?.getAppVersion?.() ?? "—";

    const fontDisplay = document.getElementById("font-size-display");
    const decreaseBtn = document.getElementById("font-decrease") as HTMLButtonElement | null;
    const increaseBtn = document.getElementById("font-increase") as HTMLButtonElement | null;
    const minimapBtn = document.getElementById("toggle-minimap") as HTMLButtonElement | null;
    const wrapBtn = document.getElementById("toggle-wordwrap") as HTMLButtonElement | null;
    const tabSelect = document.getElementById("tab-size-select") as HTMLSelectElement | null;
    const autoSaveBtn = document.getElementById("toggle-autosave") as HTMLButtonElement | null;
    if (autoSaveBtn) autoSaveBtn.textContent = autoSaveEnabled ? "ON" : "OFF";
    const logoutBtn = document.getElementById("settings-logout-btn") as HTMLButtonElement | null;
    const checkUpdatesBtn = document.getElementById("settings-check-updates-btn") as HTMLButtonElement | null;

    const getEditorOpts = (): {
        editor: {
            updateOptions?: (opts: Record<string, unknown>) => void;
            getRawOptions?: () => Record<string, unknown>;
        } | null;
        raw: Record<string, unknown>;
    } => {
        const editor = getEditor() as unknown as {
            updateOptions?: (opts: Record<string, unknown>) => void;
            getRawOptions?: () => Record<string, unknown>;
        } | null;
        const raw = typeof editor?.getRawOptions === "function" ? editor.getRawOptions() : {};
        return { editor, raw };
    };

    decreaseBtn?.addEventListener("click", () => {
        const { editor, raw } = getEditorOpts();
        let fontSize = Number(raw?.fontSize ?? 13);
        fontSize = Math.max(10, fontSize - 1);
        if (fontDisplay) fontDisplay.textContent = `${fontSize}px`;
        editor?.updateOptions?.({ fontSize });
        saveEditorSettings();
    });
    increaseBtn?.addEventListener("click", () => {
        const { editor, raw } = getEditorOpts();
        let fontSize = Number(raw?.fontSize ?? 13);
        fontSize = Math.min(24, fontSize + 1);
        if (fontDisplay) fontDisplay.textContent = `${fontSize}px`;
        editor?.updateOptions?.({ fontSize });
        saveEditorSettings();
    });
    minimapBtn?.addEventListener("click", () => {
        const { editor, raw } = getEditorOpts();
        const cur = Boolean((raw?.minimap as { enabled?: boolean } | undefined)?.enabled ?? true);
        const next = !cur;
        minimapBtn.textContent = next ? "ON" : "OFF";
        editor?.updateOptions?.({ minimap: { enabled: next } });
        saveEditorSettings();
    });
    wrapBtn?.addEventListener("click", () => {
        const { editor, raw } = getEditorOpts();
        const nextOn = String(raw?.wordWrap ?? "off") !== "on";
        wrapBtn.textContent = nextOn ? "ON" : "OFF";
        editor?.updateOptions?.({ wordWrap: nextOn ? "on" : "off" });
        saveEditorSettings();
    });
    tabSelect?.addEventListener("change", () => {
        const { editor } = getEditorOpts();
        const tabSize = Number(tabSelect.value);
        editor?.updateOptions?.({ tabSize });
        saveEditorSettings();
    });
    autoSaveBtn?.addEventListener("click", () => {
        autoSaveEnabled = !autoSaveEnabled;
        autoSaveBtn.textContent = autoSaveEnabled ? "ON" : "OFF";
        window.skiaElectron.setAutoSave(autoSaveEnabled);
        saveEditorSettings();
    });

    document.getElementById("open-docs-btn")?.addEventListener("click", () => {
        window.skiaElectron.openDocs();
    });

    logoutBtn?.addEventListener("click", () => {
        logout();
        logoutBtn.textContent = "SIGNED OUT";
        setTimeout(() => {
            logoutBtn.textContent = "SIGN OUT";
        }, 1500);
    });

    checkUpdatesBtn?.addEventListener("click", async () => {
        if (!checkUpdatesBtn) return;
        checkUpdatesBtn.textContent = "CHECKING...";
        const result = await window.skiaElectron.checkForUpdates();
        if (result.status === "up-to-date") {
            showUpdateNotice("No Update", `You are on the latest version (${result.currentVersion || "current"}).`);
        } else if (result.status === "error") {
            showUpdateNotice("Update Check Failed", result.message || "Unable to check updates.");
        }
        checkUpdatesBtn.textContent = "CHECK FOR UPDATES";
    });
};

const loadSettings = (): void => {
    refreshSettingsDisplay();
};

const setView = (view: string): void => {
    activeView = view;
    if (view === "terminal") {
        navItems.forEach((item) => {
            item.classList.toggle("is-active", item.dataset.view === "terminal");
        });
        void ensureTerminalPanelVisible();
        return;
    }

    navItems.forEach((item) => {
        item.classList.toggle("is-active", item.dataset.view === view);
    });

    Object.values(viewMap).forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = "none";
            el.classList.remove("active");
        }
    });

    const targetId = viewMap[view] ?? "editor-container";
    const target = document.getElementById(targetId);
    if (target) {
        target.style.display = targetId === "view-settings" ? "block" : "flex";
        target.classList.add("active");
    }

    if (view === "forge") void loadForgeStatus();
    if (view === "local-health") void refreshLocalHealthPanel();
    if (view === "settings") loadSettings();
};

const initializeSidebarNavigation = (): void => {
    navItems = Array.from(
        document.querySelectorAll<HTMLElement>("#skia-nav .nav-item")
    );

    navItems.forEach((item) => {
        const view = item.dataset.view ?? "explorer";
        item.addEventListener("click", () => {
            setView(view);
        });
    });

    document.getElementById("explorer-open-folder-hint")?.addEventListener("click", () => {
        void openFolderInExplorer();
    });

    setView("explorer");
};

const getEditorContent = (): string => {
    const editor = getEditor() as unknown as { getValue?: () => string; getModel?: () => unknown } | null;
    if (!editor) return "";
    if (typeof editor.getValue === "function") return editor.getValue();

    const model = typeof editor.getModel === "function" ? editor.getModel() : null;
    if (!model || typeof model !== "object") return "";
    const modelRecord = model as Record<string, unknown>;
    if (typeof modelRecord.getValue === "function") {
        return (modelRecord.getValue as () => string)();
    }
    return "";
};

const clearEditorForNewFile = (): void => {
    const editor = getEditor() as unknown as { getModel?: () => unknown } | null;
    const model = editor && typeof editor.getModel === "function" ? editor.getModel() : null;
    if (model && typeof model === "object") {
        const modelRecord = model as Record<string, unknown>;
        if (typeof modelRecord.setValue === "function") {
            (modelRecord.setValue as (content: string) => void)("");
        }
        if (typeof modelRecord.setLanguageId === "function") {
            (modelRecord.setLanguageId as (languageId: string) => void)("plaintext");
        }
    }

    setStatus("New File");
};

const setEditorContentAndLanguage = (content: string, language: string): void => {
    const editor = getEditor() as unknown as { getModel?: () => unknown; setValue?: (v: string) => void } | null;
    if (!editor) return;

    if (typeof editor.setValue === "function") {
        editor.setValue(content);
    }

    const model = typeof editor.getModel === "function" ? editor.getModel() : null;
    if (model && typeof model === "object") {
        const modelRecord = model as Record<string, unknown>;
        if (typeof modelRecord.setValue === "function") {
            (modelRecord.setValue as (value: string) => void)(content);
        }
        if (window.monaco?.editor && typeof window.monaco.editor.setModelLanguage === "function") {
            window.monaco.editor.setModelLanguage(
                model as { setValue: (value: string) => void; getValue: () => string },
                language
            );
        }
    }
};

const runEditorAction = (actionId: string): void => {
    const editor = getEditor();
    if (!editor) return;
    const action = editor.getAction(actionId);
    if (!action) return;
    const maybePromise = action.run();
    if (maybePromise instanceof Promise) {
        void maybePromise.catch((error: unknown) => {
            console.error(`SKIA: failed to run editor action ${actionId}`, error);
        });
    }
};

const toggleChatPanel = (): void => {
    const chatPanel = document.getElementById("chat-panel");
    if (!chatPanel) return;
    const currentlyHidden =
        chatPanel.style.display === "none" || window.getComputedStyle(chatPanel).display === "none";
    chatPanel.style.display = currentlyHidden ? "" : "none";
};

const focusSearchInput = (): void => {
    const input = document.getElementById("search-input") as HTMLInputElement | null;
    input?.focus();
};

const focusAgentInput = (): void => {
    const input = document.getElementById("agent-task-input") as HTMLInputElement | null;
    input?.focus();
};

const openFileInEditor = async (filePath: string): Promise<void> => {
    try {
        const content = await window.skiaElectron.readFileText(filePath);
        const language = getLanguageFromPath(filePath);
        setEditorContentAndLanguage(content, language);
        activeFilePath = filePath;
        setActiveFile(filePath);
        setStatus(getFileName(filePath));
        setView("explorer");
    } catch (error) {
        console.error("SKIA: failed to open file", error);
    }
};

const renderTreeNode = (node: SkiaDirectoryNode, depth: number): HTMLDivElement => {
    const row = document.createElement("div");
    row.className = `explorer-node explorer-${node.type}`;
    row.style.paddingLeft = `${depth * 14 + 8}px`;
    row.textContent = node.type === "directory" ? `▾ ${node.name}` : node.name;

    if (node.type === "file") {
        row.addEventListener("click", () => {
            void openFileInEditor(node.path);
        });
    }

    return row;
};

const renderExplorerTree = (rootPath: string, nodes: SkiaDirectoryNode[]): void => {
    const empty = document.getElementById("explorer-empty-state");
    const container = getExplorerTreeContent();
    if (!container) return;

    if (empty) empty.style.display = "none";
    container.style.display = "block";
    container.innerHTML = "";

    const root = document.createElement("div");
    root.className = "explorer-root";
    root.textContent = getFileName(rootPath);
    container.appendChild(root);

    const appendNodes = (items: SkiaDirectoryNode[], depth: number): void => {
        items.forEach((node) => {
            container.appendChild(renderTreeNode(node, depth));
            if (node.type === "directory" && node.children?.length) {
                appendNodes(node.children, depth + 1);
            }
        });
    };

    appendNodes(nodes, 1);
};

const openFolderInExplorer = async (): Promise<void> => {
    const folderPath = await window.skiaElectron.openFolder();
    if (!folderPath) return;

    try {
        const tree = await window.skiaElectron.readDirectoryTree(folderPath);
        activeFolderPath = folderPath;
        setWorkspacePath(folderPath);
        renderExplorerTree(folderPath, tree);
        setView("explorer");
        void getContext({
            query: `Forge IDE workspace root: ${folderPath}`,
        }).catch(() => {
            /* Forge control plane optional when offline */
        });
    } catch (error) {
        console.error("SKIA: failed to read folder tree", error);
    }
};

const openOnboardingFolderInExplorer = async (folderPath: string): Promise<void> => {
    try {
        const tree = await window.skiaElectron.readDirectoryTree(folderPath);
        activeFolderPath = folderPath;
        setWorkspacePath(folderPath);
        renderExplorerTree(folderPath, tree);
        setView("explorer");
        setStatus(`Workspace loaded: ${getFileName(folderPath)}`);
    } catch (error) {
        console.error("SKIA: failed to read onboarding folder tree", error);
    }
};

const startEmptyWorkspace = (workspacePath: string): void => {
    activeFolderPath = workspacePath;
    renderExplorerTree(workspacePath, []);
    setView("explorer");
    setStatus("Workspace ready: empty project");
};

const openFileViaMenu = async (): Promise<void> => {
    const filePath = await window.skiaElectron.openFile();
    if (!filePath) return;
    await openFileInEditor(filePath);
};

const saveCurrentFile = async (): Promise<void> => {
    const content = getEditorContent();
    if (activeFilePath) {
        const success = await window.skiaElectron.saveFile(activeFilePath, content);
        if (!success) {
            console.error("SKIA: save failed");
        }
        return;
    }
    const savedPath = await window.skiaElectron.saveFileAs(content);
    if (savedPath) {
        activeFilePath = savedPath;
        setActiveFile(savedPath);
    }
};

const saveCurrentFileAs = async (): Promise<void> => {
    const content = getEditorContent();
    const savedPath = await window.skiaElectron.saveFileAs(content);
    if (savedPath) {
        activeFilePath = savedPath;
        setActiveFile(savedPath);
    }
};

const triggerAutoSave = (): void => {
    if (!autoSaveEnabled) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        void saveCurrentFile();
    }, 1000);
};

const wireMonacoEditorPersistence = (): void => {
    const editor = getEditor() as {
        updateOptions?: (opts: Record<string, unknown>) => void;
        onDidChangeModelContent?: (listener: () => void) => void;
    } | null;
    if (!editor?.updateOptions) {
        window.setTimeout(wireMonacoEditorPersistence, 50);
        return;
    }
    const saved = loadEditorSettings();
    editor.updateOptions({
        fontSize: saved.fontSize,
        minimap: { enabled: saved.minimap },
        wordWrap: saved.wordWrap as "on" | "off",
        tabSize: saved.tabSize,
    });
    editor.onDidChangeModelContent?.(() => {
        triggerAutoSave();
    });
};

const closeEditorState = (): void => {
    activeFilePath = "";
    setActiveFile("");
    clearEditorForNewFile();
};

const closeFolderState = (): void => {
    closeEditorState();
    activeFolderPath = "";
    localStorage.removeItem("skia_workspace_path");
    const searchResults = document.getElementById("search-results");
    if (searchResults) {
        searchResults.innerHTML = "";
    }
    showExplorerEmptyState();
};

const registerMenuIpcHandlers = (): void => {
    if (menuListenersRegistered) {
        return;
    }
    menuListenersRegistered = true;

    window.skiaElectron.onMenuAction("view-explorer", () => setView("explorer"));
    window.skiaElectron.onMenuAction("view-search", () => setView("search"));
    window.skiaElectron.onMenuAction("view-agent", () => setView("agent"));
    window.skiaElectron.onMenuAction("view-forge", () => setView("forge"));
    window.skiaElectron.onMenuAction("view-settings", () => setView("settings"));
    window.skiaElectron.onMenuAction("toggle-chat", toggleChatPanel);

    window.skiaElectron.onMenuAction("find", () => runEditorAction("actions.find"));
    window.skiaElectron.onMenuAction("replace", () => runEditorAction("editor.action.startFindReplaceAction"));
    window.skiaElectron.onMenuAction("find-in-files", () => {
        setView("search");
        focusSearchInput();
    });
    window.skiaElectron.onMenuAction("toggle-comment", () => runEditorAction("editor.action.commentLine"));
    window.skiaElectron.onMenuAction("toggle-block-comment", () => runEditorAction("editor.action.blockComment"));
    window.skiaElectron.onMenuAction("expand-selection", () => runEditorAction("editor.action.smartSelect.expand"));
    window.skiaElectron.onMenuAction("shrink-selection", () => runEditorAction("editor.action.smartSelect.shrink"));
    window.skiaElectron.onMenuAction("copy-line-up", () => runEditorAction("editor.action.copyLinesUpAction"));
    window.skiaElectron.onMenuAction("copy-line-down", () => runEditorAction("editor.action.copyLinesDownAction"));
    window.skiaElectron.onMenuAction("move-line-up", () => runEditorAction("editor.action.moveLinesUpAction"));
    window.skiaElectron.onMenuAction("move-line-down", () => runEditorAction("editor.action.moveLinesDownAction"));
    window.skiaElectron.onMenuAction("add-cursor-above", () => runEditorAction("editor.action.insertCursorAbove"));
    window.skiaElectron.onMenuAction("add-cursor-below", () => runEditorAction("editor.action.insertCursorBelow"));

    window.skiaElectron.onMenuAction("new-file", () => {
        activeFilePath = "";
        setActiveFile("");
        clearEditorForNewFile();
    });
    window.skiaElectron.onMenuAction("open-file", () => {
        void openFileViaMenu();
    });
    window.skiaElectron.onMenuAction("open-folder", () => {
        void openFolderInExplorer();
    });
    window.skiaElectron.onMenuAction("save-file", () => {
        void saveCurrentFile();
    });
    window.skiaElectron.onMenuAction("save-file-as", () => {
        void saveCurrentFileAs();
    });
    window.skiaElectron.onMenuAction("save-all", () => {
        void saveCurrentFile();
    });
    window.skiaElectron.onMenuAction("toggle-auto-save", () => {
        autoSaveEnabled = !autoSaveEnabled;
        window.skiaElectron.setAutoSave(autoSaveEnabled);
        const autoSaveBtn = document.getElementById("toggle-autosave") as HTMLButtonElement | null;
        if (autoSaveBtn) autoSaveBtn.textContent = autoSaveEnabled ? "ON" : "OFF";
        saveEditorSettings();
    });
    window.skiaElectron.onMenuAction("close-editor", closeEditorState);
    window.skiaElectron.onMenuAction("close-folder", closeFolderState);
    window.skiaElectron.onOpenTerminal(() => {
        void ensureTerminalPanelVisible();
    });

    window.skiaElectron.onMenuAction("run-agent-task", () => {
        setView("agent");
        focusAgentInput();
    });
    window.skiaElectron.onMenuAction("run-cancel-task", () => {
        cancelAgentTask();
        const cancelBtn = document.getElementById("chat-cancel-btn") as HTMLButtonElement | null;
        cancelBtn?.click();
    });
    window.skiaElectron.onMenuAction("run-start-frontend", () => {
        void appendSystemTerminalLine("SKIA: frontend dev server start requested");
        setStatus("SKIA: FRONTEND START REQUESTED");
    });
    window.skiaElectron.onMenuAction("run-stop-frontend", () => {
        void appendSystemTerminalLine("SKIA: frontend dev server stop requested");
        setStatus("SKIA: FRONTEND STOP REQUESTED");
    });

    window.skiaElectron.onBackendLog((message) => {
        void appendSystemTerminalLine(message.trimEnd());
    });
    window.skiaElectron.onStatusUpdate((status) => {
        setStatus(status);
        const connectionStatus = document.getElementById("connection-status-display");
        if (connectionStatus) connectionStatus.textContent = status;
    });
};

const bootstrap = async (): Promise<void> => {
    if (process.env.NODE_ENV !== "production") console.log("SKIA: bootstrap starting");
    initForgeI18n();
    populateSettingsLocaleSelect();
    applyForgeUiStrings();
    subscribeLocaleChange(() => {
        applyForgeUiStrings();
        const select = document.getElementById("settings-locale-select") as HTMLSelectElement | null;
        if (select) select.value = getLocale();
    });
    await loadConfig();
    if (process.env.NODE_ENV !== "production") console.log("SKIA: config loaded");
    initializeAuthPanel();
    await new Promise<void>((resolve) => {
        if (isAuthenticated()) {
            resolve();
            return;
        }
        const id = window.setInterval(() => {
            if (isAuthenticated()) {
                window.clearInterval(id);
                resolve();
            }
        }, 200);
    });
    initializeMonaco();
    if (process.env.NODE_ENV !== "production") console.log("SKIA: monaco initialized");
    const editorSettings = loadEditorSettings();
    autoSaveEnabled = editorSettings.autoSave;
    window.skiaElectron.setAutoSave(autoSaveEnabled);
    wireMonacoEditorPersistence();
    initializeSettingsControlsOnce();
    initializeSidebarNavigation();
    if (process.env.NODE_ENV !== "production") console.log("SKIA: sidebar navigation initialized");
    initializeChatPanel();
    if (process.env.NODE_ENV !== "production") console.log("SKIA: chat panel initialized");
    initializeAgentPanel();
    if (process.env.NODE_ENV !== "production") console.log("SKIA: agent panel initialized");
    initializeStatusBar();
    if (process.env.NODE_ENV !== "production") console.log("SKIA: status bar initialized");
    window.addEventListener("skia-auth-ready", () => {
        syncSettingsConnectionStatus();
        if (activeView === "forge") {
            void loadForgeStatus();
        }
    });
    window.addEventListener("skia-auth-logout", () => {
        syncSettingsConnectionStatus();
    });
    window.addEventListener("skia-onboarding-folder-selected", (event) => {
        const custom = event as CustomEvent<{ folderPath?: string }>;
        const folderPath = custom.detail?.folderPath;
        if (!folderPath) return;
        void openOnboardingFolderInExplorer(folderPath);
    });
    window.addEventListener("skia-onboarding-start-empty", (event) => {
        const custom = event as CustomEvent<{ workspacePath?: string }>;
        const workspacePath = custom.detail?.workspacePath ?? "browser-workspace";
        startEmptyWorkspace(workspacePath);
    });
    initializeOnboarding();
    if (process.env.NODE_ENV !== "production") console.log("SKIA: onboarding initialized");
    initSkiaTerminalPanel();
    if (process.env.NODE_ENV !== "production") console.log("SKIA: terminal panel initialized");
    registerMenuIpcHandlers();
    if (process.env.NODE_ENV !== "production") console.log("SKIA: menu IPC handlers initialized");
    if (process.env.NODE_ENV !== "production") console.log("SKIA: bootstrap complete");
};

initializeAutoUpdateListener();
void bootstrap();