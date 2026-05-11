import "./styles/app.css";
import "./styles/skia-dark.css";
import { getEditor, initializeMonaco } from "./editor/monacoSetup";
import { loadConfig } from "./skia/skiaConfig";
import { initializeChatPanel } from "./skia/skiaChatPanel";
import { initializeStatusBar } from "./skia/skiaStatusBar";
import { initializeOnboarding } from "./skia/skiaOnboarding";
import { initializeAuthPanel, isAuthenticated, logout } from "./skia/skiaAuthPanel";
import { setActiveFile, setWorkspacePath } from "./skia/skiaSessionStore";
import {
    getContext,
    getMode,
    getGovernance,
    getModulesStatus,
    SkiaOfflineError,
} from "./skia/skiaApiClient";

const viewMap: Record<string, string> = {
    explorer: "editor-container",
    search: "view-search",
    agent: "view-agent",
    forge: "view-forge",
    settings: "view-settings"
};

let navItems: HTMLElement[] = [];
let activeFilePath = "";
let activeFolderPath = "";
let menuListenersRegistered = false;
let terminalOutputEl: HTMLDivElement | null = null;
/** Tracked cwd for single-command terminal exec (PowerShell); synced after each command via (Get-Location).Path */
let terminalCwd = "C:\\SKIA-Forge";
let autoSaveEnabled = false;

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
        <div id="skia-update-status" style="margin-top:8px;font-size:11px;color:rgba(255,255,255,0.78);">Downloading…</div>
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
            msg.style.color = "#e8a0a0";
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
        host.style.color = "#f1e2ad";
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
      <div style="font-size:12px;letter-spacing:0.08em;color:#d4af37;text-transform:uppercase;margin-bottom:6px;">${title}</div>
      <div style="font-size:12px;line-height:1.5;color:rgba(255,255,255,0.86);">${message}</div>
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

const ensureExplorerTreeContainer = (): HTMLDivElement | null => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return null;

    let tree = document.getElementById("explorer-tree") as HTMLDivElement | null;
    if (!tree) {
        tree = document.createElement("div");
        tree.id = "explorer-tree";
        sidebar.appendChild(tree);
    }
    return tree;
};

const loadForgeStatus = async (): Promise<void> => {
    const modeEl = document.getElementById("forge-mode");
    const govEl = document.getElementById("forge-governance");
    const modEl = document.getElementById("forge-modules");

    if (modeEl) modeEl.textContent = "Loading...";
    if (govEl) govEl.textContent = "";
    if (modEl) modEl.textContent = "";

    try {
        const [mode, gov, modules] = await Promise.all([
            getMode(),
            getGovernance(),
            getModulesStatus()
        ]);
        if (!mode || !gov || !modules) {
            throw new SkiaOfflineError();
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
        if (!(error instanceof SkiaOfflineError) && !(error instanceof Error)) {
            // Non-standard error shape; show unavailable state without noisy logging.
        }
        if (modeEl) {
            modeEl.innerHTML = `<div class="forge-row"><span class="forge-value" style="color:#8a6f1e">Control plane telemetry temporarily unavailable. Core SKIA features remain available.</span></div>`;
        }
    }
};

const loadSettings = (): void => {
    const decreaseBtn = document.getElementById("font-decrease") as HTMLButtonElement | null;
    const increaseBtn = document.getElementById("font-increase") as HTMLButtonElement | null;
    const fontDisplay = document.getElementById("font-size-display");
    const minimapBtn = document.getElementById("toggle-minimap") as HTMLButtonElement | null;
    const wrapBtn = document.getElementById("toggle-wordwrap") as HTMLButtonElement | null;
    const tabSelect = document.getElementById("tab-size-select") as HTMLSelectElement | null;
    const autoSaveBtn = document.getElementById("toggle-autosave") as HTMLButtonElement | null;
    const statusDisplay = document.getElementById("connection-status-display");
    const logoutBtn = document.getElementById("settings-logout-btn") as HTMLButtonElement | null;
    const checkUpdatesBtn = document.getElementById("settings-check-updates-btn") as HTMLButtonElement | null;

    if (statusDisplay) {
        statusDisplay.textContent = (document.getElementById("status-text")?.textContent ?? "Disconnected").replace("⬡ ", "");
    }

    const editor = getEditor() as unknown as {
        updateOptions?: (opts: Record<string, unknown>) => void;
        getRawOptions?: () => Record<string, unknown>;
    } | null;
    const rawOptions = typeof editor?.getRawOptions === "function" ? editor.getRawOptions() : {};
    let fontSize = Number(rawOptions?.fontSize ?? 13);
    let minimapEnabled = Boolean((rawOptions?.minimap as { enabled?: boolean } | undefined)?.enabled ?? true);
    let wordWrapOn = String(rawOptions?.wordWrap ?? "off") === "on";
    let tabSize = Number(rawOptions?.tabSize ?? 4);

    if (fontDisplay) fontDisplay.textContent = `${fontSize}px`;
    if (minimapBtn) minimapBtn.textContent = minimapEnabled ? "ON" : "OFF";
    if (wrapBtn) wrapBtn.textContent = wordWrapOn ? "ON" : "OFF";
    if (tabSelect) tabSelect.value = String(tabSize);
    if (autoSaveBtn) autoSaveBtn.textContent = autoSaveEnabled ? "ON" : "OFF";

    decreaseBtn?.addEventListener("click", () => {
        fontSize = Math.max(10, fontSize - 1);
        if (fontDisplay) fontDisplay.textContent = `${fontSize}px`;
        editor?.updateOptions?.({ fontSize });
    });
    increaseBtn?.addEventListener("click", () => {
        fontSize = Math.min(24, fontSize + 1);
        if (fontDisplay) fontDisplay.textContent = `${fontSize}px`;
        editor?.updateOptions?.({ fontSize });
    });
    minimapBtn?.addEventListener("click", () => {
        minimapEnabled = !minimapEnabled;
        minimapBtn.textContent = minimapEnabled ? "ON" : "OFF";
        editor?.updateOptions?.({ minimap: { enabled: minimapEnabled } });
    });
    wrapBtn?.addEventListener("click", () => {
        wordWrapOn = !wordWrapOn;
        wrapBtn.textContent = wordWrapOn ? "ON" : "OFF";
        editor?.updateOptions?.({ wordWrap: wordWrapOn ? "on" : "off" });
    });
    tabSelect?.addEventListener("change", () => {
        tabSize = Number(tabSelect.value);
        editor?.updateOptions?.({ tabSize });
    });
    autoSaveBtn?.addEventListener("click", () => {
        autoSaveEnabled = !autoSaveEnabled;
        autoSaveBtn.textContent = autoSaveEnabled ? "ON" : "OFF";
        window.skiaElectron.setAutoSave(autoSaveEnabled);
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

const ensureTerminalPanelVisible = (): void => {
    const terminalPanel = document.getElementById("terminal-panel") as HTMLDivElement | null;
    const terminalInput = document.getElementById("terminal-input") as HTMLInputElement | null;
    if (!terminalPanel) return;
    terminalPanel.style.display = "flex";
    if (!terminalOutputEl) {
        terminalOutputEl = document.getElementById("terminal-output") as HTMLDivElement | null;
    }
    terminalInput?.focus();
};

const setView = (view: string): void => {
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
        target.style.display = "flex";
        target.classList.add("active");
    }

    if (view === "forge") void loadForgeStatus();
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

const appendTerminalLog = (line: string): void => {
    ensureTerminalPanelVisible();
    if (!terminalOutputEl) return;
    terminalOutputEl.textContent += `${line}\n`;
    terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;
};

const initializeTerminalHandlers = (): void => {
    const terminalInput = document.getElementById("terminal-input") as HTMLInputElement | null;
    const terminalClose = document.getElementById("terminal-close") as HTMLButtonElement | null;
    const terminalPanel = document.getElementById("terminal-panel") as HTMLDivElement | null;

    terminalClose?.addEventListener("click", () => {
        if (terminalPanel) terminalPanel.style.display = "none";
    });
    terminalInput?.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const command = terminalInput.value.trim();
        if (!command) return;
        appendTerminalLog(`❯ ${command}`);
        terminalInput.value = "";
        const cwd = terminalCwd;
        // One exec = one shell; chain (Get-Location).Path so cwd reflects cd/set-location in this invocation.
        const combined = `${command}; (Get-Location).Path`;
        const result = await window.skiaElectron.runCommand(combined, cwd);
        if (result.stdout) appendTerminalLog(result.stdout.trimEnd());
        if (result.stderr) appendTerminalLog(result.stderr.trimEnd());
        const raw = (result.stdout || "").trimEnd();
        const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
        for (let i = lines.length - 1; i >= 0; i -= 1) {
            const candidate = lines[i].trim();
            if (/^([A-Za-z]:[\\/]|\\\\)/.test(candidate)) {
                terminalCwd = candidate;
                break;
            }
        }
    });
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
    const container = ensureExplorerTreeContainer();
    if (!container) return;

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
    const tree = document.getElementById("explorer-tree");
    if (tree) {
        tree.innerHTML = "";
    }
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
    });
    window.skiaElectron.onMenuAction("close-editor", closeEditorState);
    window.skiaElectron.onMenuAction("close-folder", closeFolderState);
    window.skiaElectron.onMenuAction("open-terminal", ensureTerminalPanelVisible);

    window.skiaElectron.onMenuAction("run-agent-task", () => {
        setView("agent");
        focusAgentInput();
    });
    window.skiaElectron.onMenuAction("run-cancel-task", () => {
        const cancelBtn = document.getElementById("chat-cancel-btn") as HTMLButtonElement | null;
        cancelBtn?.click();
    });
    window.skiaElectron.onMenuAction("run-start-backend", () => {
        appendTerminalLog("SKIA: backend start requested");
        setStatus("SKIA: BACKEND START REQUESTED");
    });
    window.skiaElectron.onMenuAction("run-stop-backend", () => {
        appendTerminalLog("SKIA: backend stop requested");
        setStatus("SKIA: BACKEND STOP REQUESTED");
    });
    window.skiaElectron.onMenuAction("run-start-frontend", () => {
        appendTerminalLog("SKIA: frontend dev server start requested");
        setStatus("SKIA: FRONTEND START REQUESTED");
    });
    window.skiaElectron.onMenuAction("run-stop-frontend", () => {
        appendTerminalLog("SKIA: frontend dev server stop requested");
        setStatus("SKIA: FRONTEND STOP REQUESTED");
    });

    window.skiaElectron.onBackendLog((message) => {
        appendTerminalLog(message.trimEnd());
    });
    window.skiaElectron.onStatusUpdate((status) => {
        setStatus(status);
        const connectionStatus = document.getElementById("connection-status-display");
        if (connectionStatus) connectionStatus.textContent = status;
    });
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
};

const bootstrap = async (): Promise<void> => {
    console.log("SKIA: bootstrap starting");
    await loadConfig();
    console.log("SKIA: config loaded");
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
    console.log("SKIA: monaco initialized");
    initializeSidebarNavigation();
    console.log("SKIA: sidebar navigation initialized");
    initializeChatPanel();
    console.log("SKIA: chat panel initialized");
    initializeStatusBar();
    console.log("SKIA: status bar initialized");
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
    console.log("SKIA: onboarding initialized");
    initializeTerminalHandlers();
    console.log("SKIA: terminal handlers initialized");
    registerMenuIpcHandlers();
    console.log("SKIA: menu IPC handlers initialized");
    console.log("SKIA: bootstrap complete");
};

void bootstrap();