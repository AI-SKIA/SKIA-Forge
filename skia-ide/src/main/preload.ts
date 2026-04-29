import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("skiaElectron", {
  getConfig: () => ipcRenderer.invoke("skia:getConfig"),
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
  checkForUpdates: () => ipcRenderer.invoke("skia:checkForUpdates"),
  setAutoSave: (enabled: boolean) => ipcRenderer.send("skia:setAutoSave", enabled),
  openDocs: () => ipcRenderer.send("open-docs"),
  getCookies: (url: string): Promise<Array<{ name: string; value: string }>> =>
    ipcRenderer.invoke("skia:getCookies", url),
  openExternal: (url: string) => ipcRenderer.send("open-external", url),
  saveCredentials: (email: string, password: string) => ipcRenderer.invoke("skia:saveCredentials", { email, password }),
  getSavedCredentials: (): Promise<{ email: string; password: string } | null> =>
    ipcRenderer.invoke("skia:getSavedCredentials"),
  clearSavedCredentials: (): Promise<boolean> => ipcRenderer.invoke("skia:clearSavedCredentials")
});
