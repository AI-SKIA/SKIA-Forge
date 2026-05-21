import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("__SKIA_PLATFORM__", "forge-ide");

let updateProgressWrap: ((_event: Electron.IpcRendererEvent, data: { percent: number }) => void) | null = null;
let updateErrorWrap: ((_event: Electron.IpcRendererEvent, data: { message: string }) => void) | null = null;

contextBridge.exposeInMainWorld("skiaElectron", {
    // ── Existing APIs (unchanged) ────────────────────────────────────────────
    getConfig: () => ipcRenderer.invoke("skia:getConfig"),
    getAppVersion: () => ipcRenderer.sendSync("get-app-version") as string,
    openFolder: () => ipcRenderer.invoke("skia:openFolder"),
    openFile: () => ipcRenderer.invoke("skia:openFile"),
    saveFile: (filePath: string, content: string) => ipcRenderer.invoke("skia:saveFile", filePath, content),
    saveFileAs: (content: string) => ipcRenderer.invoke("skia:saveFileAs", content),
    readFileText: (filePath: string) => ipcRenderer.invoke("skia:readFileText", filePath),
    readDirectoryTree: (folderPath: string) => ipcRenderer.invoke("skia:readDirectoryTree", folderPath),
    onMenuAction: (channel: string, listener: () => void) => {
        const wrapped = () => listener();
        ipcRenderer.on(channel, wrapped);
        return () => ipcRenderer.removeListener(channel, wrapped);
    },
    onBackendLog: (listener: (payload: string) => void) => {
        const wrapped = (_event: Electron.IpcRendererEvent, payload: string) => {
            listener(payload);
        };
        ipcRenderer.on("backend-log", wrapped);
        return () => ipcRenderer.removeListener("backend-log", wrapped);
    },
    onStatusUpdate: (listener: (status: string) => void) => {
        const wrapped = (_event: Electron.IpcRendererEvent, status: string) => {
            listener(status);
        };
        ipcRenderer.on("status-update", wrapped);
        return () => ipcRenderer.removeListener("status-update", wrapped);
    },
    onUpdateStatus: (
        listener: (payload: { status: "update-available" | "up-to-date" | "error"; latestVersion?: string; downloadUrl?: string; currentVersion?: string; message?: string }) => void
    ) => {
        const wrapped = (
            _event: Electron.IpcRendererEvent,
            payload: { status: "update-available" | "up-to-date" | "error"; latestVersion?: string; downloadUrl?: string; currentVersion?: string; message?: string }
        ) => {
            listener(payload);
        };
        ipcRenderer.on("update-status", wrapped);
        return () => ipcRenderer.removeListener("update-status", wrapped);
    },
    runCommand: (cmd: string, cwd?: string) => ipcRenderer.invoke("skia:runCommand", cmd, cwd),

    ptyCreate: (cwd?: string): Promise<{ id: string; cwd: string; shell: string }> =>
        ipcRenderer.invoke("skia:pty:create", cwd),
    ptyWrite: (id: string, data: string): void => {
        ipcRenderer.send("skia:pty:write", id, data);
    },
    ptyResize: (id: string, cols: number, rows: number): void => {
        ipcRenderer.send("skia:pty:resize", id, cols, rows);
    },
    ptyKill: (id: string): Promise<void> => ipcRenderer.invoke("skia:pty:kill", id),

    onPtyData: (listener: (payload: { id: string; data: string }) => void): (() => void) => {
        const wrapped = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) => listener(payload);
        ipcRenderer.on("skia:pty-data", wrapped);
        return () => ipcRenderer.removeListener("skia:pty-data", wrapped);
    },
    onPtyExit: (listener: (payload: { id: string; exitCode: number; signal?: number }) => void): (() => void) => {
        const wrapped = (
            _event: Electron.IpcRendererEvent,
            payload: { id: string; exitCode: number; signal?: number }
        ) => listener(payload);
        ipcRenderer.on("skia:pty-exit", wrapped);
        return () => ipcRenderer.removeListener("skia:pty-exit", wrapped);
    },
    checkForUpdates: () => ipcRenderer.invoke("skia:checkForUpdates"),
    notifyRendererReady: () => {
        ipcRenderer.send("skia:rendererReady");
    },
    downloadAndInstall: (downloadUrl: string) => ipcRenderer.invoke("skia:downloadAndInstall", downloadUrl),
    onUpdateDownloadProgress: (listener: (data: { percent: number }) => void): void => {
        if (updateProgressWrap) {
            ipcRenderer.removeListener("update-download-progress", updateProgressWrap);
        }
        updateProgressWrap = (_event: Electron.IpcRendererEvent, data: { percent: number }) => {
            listener(data);
        };
        ipcRenderer.on("update-download-progress", updateProgressWrap);
    },
    onUpdateDownloadError: (listener: (data: { message: string }) => void): void => {
        if (updateErrorWrap) {
            ipcRenderer.removeListener("update-download-error", updateErrorWrap);
        }
        updateErrorWrap = (_event: Electron.IpcRendererEvent, data: { message: string }) => {
            listener(data);
        };
        ipcRenderer.on("update-download-error", updateErrorWrap);
    },
    setAutoSave: (enabled: boolean) => ipcRenderer.send("skia:setAutoSave", enabled),
    openDocs: () => ipcRenderer.send("open-docs"),
    getCookies: (url: string): Promise<Array<{ name: string; value: string }>> =>
        ipcRenderer.invoke("skia:getCookies", url),
    openExternal: (url: string) => ipcRenderer.send("open-external", url),
    saveCredentials: (email: string, password: string) => ipcRenderer.invoke("skia:saveCredentials", { email, password }),
    getSavedCredentials: (): Promise<{ email: string; password: string } | null> =>
        ipcRenderer.invoke("skia:getSavedCredentials"),
    clearSavedCredentials: (): Promise<boolean> => ipcRenderer.invoke("skia:clearSavedCredentials"),

    // ── Project root ─────────────────────────────────────────────────────────
    // Get the folder currently open in the IDE
    getProjectRoot: (): Promise<string | null> =>
        ipcRenderer.invoke("skia:getProjectRoot"),
    // Explicitly set the project root (e.g. drag-and-drop or typed path)
    setProjectRoot: (folderPath: string): Promise<void> =>
        ipcRenderer.invoke("skia:setProjectRoot", folderPath),
    // Subscribe to project root changes — fires whenever the user opens a folder
    onProjectRootChanged: (listener: (root: string) => void) => {
        const wrapped = (_event: Electron.IpcRendererEvent, root: string) => listener(root);
        ipcRenderer.on("skia:projectRootChanged", wrapped);
        return () => ipcRenderer.removeListener("skia:projectRootChanged", wrapped);
    },

    // ── Terminal ─────────────────────────────────────────────────────────────
    // Listen for the "Open Terminal" menu action.
    // Payload now includes { cwd } so the panel opens in the right directory.
    onOpenTerminal: (listener: (payload: { cwd: string }) => void) => {
        const wrapped = (_event: Electron.IpcRendererEvent, payload: { cwd: string }) => listener(payload);
        ipcRenderer.on("open-terminal", wrapped);
        return () => ipcRenderer.removeListener("open-terminal", wrapped);
    },

    // ── SKIA brain observability ─────────────────────────────────────────────
    // SKIA can subscribe to every command result to stay aware of terminal activity
    onCommandResult: (listener: (payload: { cmd: string; cwd: string; stdout: string; stderr: string; exitCode: number }) => void) => {
        const wrapped = (
            _event: Electron.IpcRendererEvent,
            payload: { cmd: string; cwd: string; stdout: string; stderr: string; exitCode: number }
        ) => listener(payload);
        ipcRenderer.on("skia:commandResult", wrapped);
        return () => ipcRenderer.removeListener("skia:commandResult", wrapped);
    },
});