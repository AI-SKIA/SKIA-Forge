import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("skiaElectron", {
  getConfig: () => ipcRenderer.invoke("skia:getConfig"),
  openFolder: () => ipcRenderer.invoke("skia:openFolder"),
  openFile: () => ipcRenderer.invoke("skia:openFile")
});
