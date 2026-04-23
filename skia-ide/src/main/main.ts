import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";

type SkiaConfig = {
  backendUrl: string;
  authToken: string;
  timeout: number;
};

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  const iconPath = path.resolve(__dirname, "../../assets/skia-icon.png");
  const preloadPath = path.resolve(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: "SKIA FORGE",
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });

  const rendererPath = path.resolve(__dirname, "../renderer/index.html");
  void mainWindow.loadFile(rendererPath);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

ipcMain.handle("skia:getConfig", (): SkiaConfig => {
  return {
    backendUrl: process.env.SKIA_BACKEND_URL ?? "http://127.0.0.1:3000",
    authToken: process.env.SKIA_AUTH_TOKEN ?? "",
    timeout: Number(process.env.SKIA_TIMEOUT_MS ?? "10000")
  };
});

ipcMain.handle("skia:openFolder", async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle("skia:openFile", async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"]
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
