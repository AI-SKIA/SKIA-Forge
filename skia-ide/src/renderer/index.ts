import "./styles/app.css";
import "./styles/skia-dark.css";
import { getEditor, initializeMonaco } from "./editor/monacoSetup";
import { loadConfig } from "./skia/skiaConfig";
import { initializeChatPanel } from "./skia/skiaChatPanel";
import { initializeStatusBar } from "./skia/skiaStatusBar";
import { initializeOnboarding } from "./skia/skiaOnboarding";
import { initializeAuthPanel, isAuthenticated } from "./skia/skiaAuthPanel";
import { setActiveFile } from "./skia/skiaSessionStore";
import { getMode, getGovernance, getModulesStatus, SkiaOfflineError } from "./skia/skiaApiClient";

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
let autoSaveEnabled = false;

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
            modeEl.innerHTML = `<div class="forge-row"><span class="forge-value" style="color:#8a6f1e">Backend unavailable — start SKIA-Forge with npm run dev</span></div>`;
        }
    }
};

const loadSettings = (): void => {
    const urlInput = document.getElementById("settings-backend-url") as HTMLInputElement | null;
    const tokenInput = document.getElementById("settings-auth-token") as HTMLInputElement | null;
    const saveBtn = document.getElementById("settings-save-btn") as HTMLButtonElement | null;
    const decreaseBtn = document.getElementById("font-decrease") as HTMLButtonElement | null;
    const increaseBtn = document.getElementById("font-increase") as HTMLButtonElement | null;
    const fontDisplay = document.getElementById("font-size-display");
    const minimapBtn = document.getElementById("toggle-minimap") as HTMLButtonElement | null;
    const wrapBtn = document.getElementById("toggle-wordwrap") as HTMLButtonElement | null;
    const tabSelect = document.getElementById("tab-size-select") as HTMLSelectElement | null;
    const autoSaveBtn = document.getElementById("toggle-autosave") as HTMLButtonElement | null;
    const statusDisplay = document.getElementById("connection-status-display");

    if (urlInput) {
        urlInput.value = localStorage.getItem("skia_backend_url") ?? "https://api.skia.ca";
    }
    if (tokenInput) {
        tokenInput.value = localStorage.getItem("skia_auth_token") ?? "";
    }
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

    saveBtn?.addEventListener("click", () => {
        if (urlInput) localStorage.setItem("skia_backend_url", urlInput.value);
        if (tokenInput) localStorage.setItem("skia_auth_token", tokenInput.value);
        saveBtn.textContent = "SAVED";
        setTimeout(() => {
            saveBtn.textContent = "SAVE CONNECTION";
        }, 2000);
    });

    document.getElementById("open-docs-btn")?.addEventListener("click", () => {
        window.skiaElectron.openDocs();
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
        const result = await window.skiaElectron.runCommand(command);
        if (result.stdout) appendTerminalLog(result.stdout.trimEnd());
        if (result.stderr) appendTerminalLog(result.stderr.trimEnd());
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
        renderExplorerTree(folderPath, tree);
        setView("explorer");
    } catch (error) {
        console.error("SKIA: failed to read folder tree", error);
    }
};

const openOnboardingFolderInExplorer = async (folderPath: string): Promise<void> => {
    try {
        const tree = await window.skiaElectron.readDirectoryTree(folderPath);
        activeFolderPath = folderPath;
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