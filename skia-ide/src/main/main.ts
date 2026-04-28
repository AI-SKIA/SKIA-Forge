import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItem, shell, session } from "electron";
import { exec, spawn, type ChildProcessWithoutNullStreams, type ExecException } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type SkiaConfig = {
    backendUrl: string;
    authToken: string;
    timeout: number;
};

type DirTreeNode = {
    name: string;
    path: string;
    type: "file" | "directory";
    children?: DirTreeNode[];
};

let mainWindow: BrowserWindow | null = null;
let autoSaveEnabled = false;
let forgeProcess: ChildProcessWithoutNullStreams | null = null;

const getMenuTargetWindow = (fallbackWindow: BrowserWindow): BrowserWindow => {
    return BrowserWindow.getFocusedWindow() ?? fallbackWindow;
};

const sendToRenderer = (win: BrowserWindow, channel: string): void => {
    const targetWindow = getMenuTargetWindow(win);
    targetWindow.webContents.send(channel);
};

const setZoomLevel = (win: BrowserWindow, delta: number): void => {
    const targetWindow = getMenuTargetWindow(win);
    const currentLevel = targetWindow.webContents.getZoomLevel();
    targetWindow.webContents.setZoomLevel(currentLevel + delta);
};

const getRendererFileUrl = (relativeFromRendererRoot: string): string => {
    const absolutePath = path.join(__dirname, "../renderer", relativeFromRendererRoot);
    return pathToFileURL(absolutePath).toString();
};

const openLocalDocumentation = async (): Promise<void> => {
    const docPath = path.join(__dirname, "../renderer/docs/index.html");
    await shell.openExternal(`file://${docPath}`);
};

const openLocalChangelog = async (): Promise<void> => {
    const changelogPath = path.join(__dirname, "../renderer/docs/changelog.html");
    await shell.openExternal(`file://${changelogPath}`);
};

const showAboutWindow = (): void => {
    const aboutWindow = new BrowserWindow({
        width: 480,
        height: 320,
        resizable: false,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        frame: false,
        transparent: false,
        backgroundColor: "#0a0a0a",
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    const logoUrl = getRendererFileUrl("assets/logo.png");
    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0a;
    color: #c9b37a;
    font-family: 'Segoe UI', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    border: 1px solid #2a1f00;
    user-select: none;
  }
  .logo {
    width: 72px;
    height: 72px;
    margin-bottom: 16px;
    border-radius: 50%;
    object-fit: cover;
  }
  h1 {
    color: #d4af37;
    font-size: 18px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .version {
    font-size: 11px;
    color: rgba(212,175,55,0.5);
    letter-spacing: 0.1em;
    margin-bottom: 4px;
  }
  .tagline {
    font-size: 11px;
    color: rgba(212,175,55,0.35);
    letter-spacing: 0.08em;
    margin-bottom: 24px;
  }
  .close-btn {
    background: transparent;
    border: 1px solid rgba(212,175,55,0.3);
    color: #d4af37;
    padding: 8px 32px;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .close-btn:hover {
    background: rgba(212,175,55,0.08);
  }
</style>
</head>
<body>
  <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
  <h1>SKIA FORGE</h1>
  <div class="version">Version 0.1.0 — Sovereign Intelligence</div>
  <div class="tagline">One ecosystem. One universe. All SKIA.</div>
  <button class="close-btn" onclick="window.close()">CLOSE</button>
</body>
</html>`;

    void aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    aboutWindow.on("blur", () => {
        aboutWindow.close();
    });
};

const emitBackendLog = (message: string): void => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
        win.webContents.send("backend-log", message);
    });
};

const startBackendProcess = (): void => {
    if (forgeProcess) {
        emitBackendLog("SKIA: backend already running");
        return;
    }

    forgeProcess = spawn("npm", ["run", "dev"], {
        cwd: "C:\\SKIA-Forge",
        shell: true,
        detached: false
    });

    const windows = BrowserWindow.getAllWindows();
    windows.forEach((windowRef) => {
        windowRef.webContents.send("status-update", "SKIA: CONNECTING...");
    });

    forgeProcess.stdout.on("data", (data: Buffer) => {
        emitBackendLog(data.toString());
    });
    forgeProcess.stderr.on("data", (data: Buffer) => {
        emitBackendLog(data.toString());
    });
    forgeProcess.on("close", (code) => {
        emitBackendLog(`SKIA: backend stopped (code ${String(code ?? 0)})`);
        forgeProcess = null;
    });
    forgeProcess.on("error", (error) => {
        emitBackendLog(`SKIA: backend start failed: ${error.message}`);
        forgeProcess = null;
    });
};

const stopBackendProcess = (): void => {
    if (!forgeProcess) {
        emitBackendLog("SKIA: backend is not running");
        return;
    }
    forgeProcess.kill();
    forgeProcess = null;
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((windowRef) => {
        windowRef.webContents.send("status-update", "SKIA: DISCONNECTED");
    });
};

const buildApplicationMenu = (win: BrowserWindow): void => {
    const menu = new Menu();

    const fileMenu = new Menu();
    fileMenu.append(
        new MenuItem({
            label: "New File",
            accelerator: "Ctrl+N",
            click: () => sendToRenderer(win, "new-file")
        })
    );
    fileMenu.append(
        new MenuItem({
            label: "New Window",
            accelerator: "Ctrl+Shift+N",
            click: () => createWindow()
        })
    );
    fileMenu.append(
        new MenuItem({
            label: "Open File...",
            accelerator: "Ctrl+O",
            click: () => sendToRenderer(win, "open-file")
        })
    );
    fileMenu.append(
        new MenuItem({
            label: "Open Folder...",
            accelerator: "Ctrl+K Ctrl+O",
            click: () => sendToRenderer(win, "open-folder")
        })
    );
    const openRecentMenu = new Menu();
    openRecentMenu.append(
        new MenuItem({
            label: "No recent files",
            enabled: false
        })
    );
    fileMenu.append(
        new MenuItem({
            label: "Open Recent",
            submenu: openRecentMenu
        })
    );
    fileMenu.append(new MenuItem({ type: "separator" }));
    fileMenu.append(
        new MenuItem({
            label: "Save",
            accelerator: "Ctrl+S",
            click: () => sendToRenderer(win, "save-file")
        })
    );
    fileMenu.append(
        new MenuItem({
            label: "Save As...",
            accelerator: "Ctrl+Shift+S",
            click: () => sendToRenderer(win, "save-file-as")
        })
    );
    fileMenu.append(
        new MenuItem({
            label: "Save All",
            accelerator: "Ctrl+K S",
            click: () => sendToRenderer(win, "save-all")
        })
    );
    fileMenu.append(new MenuItem({ type: "separator" }));
    fileMenu.append(
        new MenuItem({
            label: "Auto Save",
            type: "checkbox",
            checked: autoSaveEnabled,
            click: (item) => {
                autoSaveEnabled = item.checked;
                sendToRenderer(win, "toggle-auto-save");
            }
        })
    );
    fileMenu.append(new MenuItem({ type: "separator" }));
    fileMenu.append(
        new MenuItem({
            label: "Close Editor",
            accelerator: "Ctrl+F4",
            click: () => sendToRenderer(win, "close-editor")
        })
    );
    fileMenu.append(
        new MenuItem({
            label: "Close Folder",
            click: () => sendToRenderer(win, "close-folder")
        })
    );
    fileMenu.append(
        new MenuItem({
            label: "Close Window",
            accelerator: "Alt+F4",
            click: () => {
                const targetWindow = getMenuTargetWindow(win);
                targetWindow.close();
            }
        })
    );
    fileMenu.append(new MenuItem({ type: "separator" }));
    fileMenu.append(
        new MenuItem({
            label: "Exit",
            click: () => app.quit()
        })
    );

    const editMenu = new Menu();
    editMenu.append(
        new MenuItem({
            label: "Undo",
            accelerator: "Ctrl+Z",
            click: () => getMenuTargetWindow(win).webContents.undo()
        })
    );
    editMenu.append(
        new MenuItem({
            label: "Redo",
            accelerator: "Ctrl+Shift+Z",
            click: () => getMenuTargetWindow(win).webContents.redo()
        })
    );
    editMenu.append(new MenuItem({ type: "separator" }));
    editMenu.append(
        new MenuItem({
            label: "Cut",
            accelerator: "Ctrl+X",
            click: () => getMenuTargetWindow(win).webContents.cut()
        })
    );
    editMenu.append(
        new MenuItem({
            label: "Copy",
            accelerator: "Ctrl+C",
            click: () => getMenuTargetWindow(win).webContents.copy()
        })
    );
    editMenu.append(
        new MenuItem({
            label: "Paste",
            accelerator: "Ctrl+V",
            click: () => getMenuTargetWindow(win).webContents.paste()
        })
    );
    editMenu.append(
        new MenuItem({
            label: "Select All",
            accelerator: "Ctrl+A",
            click: () => getMenuTargetWindow(win).webContents.selectAll()
        })
    );
    editMenu.append(new MenuItem({ type: "separator" }));
    editMenu.append(
        new MenuItem({
            label: "Find",
            accelerator: "Ctrl+F",
            click: () => sendToRenderer(win, "find")
        })
    );
    editMenu.append(
        new MenuItem({
            label: "Find in Files",
            accelerator: "Ctrl+Shift+F",
            click: () => sendToRenderer(win, "find-in-files")
        })
    );
    editMenu.append(
        new MenuItem({
            label: "Replace",
            accelerator: "Ctrl+H",
            click: () => sendToRenderer(win, "replace")
        })
    );
    editMenu.append(new MenuItem({ type: "separator" }));
    editMenu.append(
        new MenuItem({
            label: "Toggle Line Comment",
            accelerator: "Ctrl+/",
            click: () => sendToRenderer(win, "toggle-comment")
        })
    );
    editMenu.append(
        new MenuItem({
            label: "Toggle Block Comment",
            accelerator: "Ctrl+Shift+A",
            click: () => sendToRenderer(win, "toggle-block-comment")
        })
    );

    const selectionMenu = new Menu();
    selectionMenu.append(
        new MenuItem({
            label: "Select All",
            accelerator: "Ctrl+A",
            click: () => getMenuTargetWindow(win).webContents.selectAll()
        })
    );
    selectionMenu.append(
        new MenuItem({
            label: "Expand Selection",
            accelerator: "Shift+Alt+Right",
            click: () => sendToRenderer(win, "expand-selection")
        })
    );
    selectionMenu.append(
        new MenuItem({
            label: "Shrink Selection",
            accelerator: "Shift+Alt+Left",
            click: () => sendToRenderer(win, "shrink-selection")
        })
    );
    selectionMenu.append(new MenuItem({ type: "separator" }));
    selectionMenu.append(
        new MenuItem({
            label: "Copy Line Up",
            accelerator: "Shift+Alt+Up",
            click: () => sendToRenderer(win, "copy-line-up")
        })
    );
    selectionMenu.append(
        new MenuItem({
            label: "Copy Line Down",
            accelerator: "Shift+Alt+Down",
            click: () => sendToRenderer(win, "copy-line-down")
        })
    );
    selectionMenu.append(
        new MenuItem({
            label: "Move Line Up",
            accelerator: "Alt+Up",
            click: () => sendToRenderer(win, "move-line-up")
        })
    );
    selectionMenu.append(
        new MenuItem({
            label: "Move Line Down",
            accelerator: "Alt+Down",
            click: () => sendToRenderer(win, "move-line-down")
        })
    );
    selectionMenu.append(new MenuItem({ type: "separator" }));
    selectionMenu.append(
        new MenuItem({
            label: "Add Cursor Above",
            accelerator: "Ctrl+Alt+Up",
            click: () => sendToRenderer(win, "add-cursor-above")
        })
    );
    selectionMenu.append(
        new MenuItem({
            label: "Add Cursor Below",
            accelerator: "Ctrl+Alt+Down",
            click: () => sendToRenderer(win, "add-cursor-below")
        })
    );

    const viewMenu = new Menu();
    viewMenu.append(
        new MenuItem({
            label: "Explorer",
            accelerator: "Ctrl+Shift+E",
            click: () => sendToRenderer(win, "view-explorer")
        })
    );
    viewMenu.append(
        new MenuItem({
            label: "Search",
            accelerator: "Ctrl+Shift+F",
            click: () => sendToRenderer(win, "view-search")
        })
    );
    viewMenu.append(
        new MenuItem({
            label: "Agent",
            accelerator: "Ctrl+Shift+A",
            click: () => sendToRenderer(win, "view-agent")
        })
    );
    viewMenu.append(
        new MenuItem({
            label: "Forge",
            accelerator: "Ctrl+Shift+G",
            click: () => sendToRenderer(win, "view-forge")
        })
    );
    viewMenu.append(
        new MenuItem({
            label: "Settings",
            accelerator: "Ctrl+,",
            click: () => sendToRenderer(win, "view-settings")
        })
    );
    viewMenu.append(new MenuItem({ type: "separator" }));
    viewMenu.append(
        new MenuItem({
            label: "Toggle Chat Panel",
            click: () => sendToRenderer(win, "toggle-chat")
        })
    );
    viewMenu.append(new MenuItem({ type: "separator" }));
    viewMenu.append(
        new MenuItem({
            label: "Zoom In",
            accelerator: "Ctrl+=",
            click: () => setZoomLevel(win, 1)
        })
    );
    viewMenu.append(
        new MenuItem({
            label: "Zoom Out",
            accelerator: "Ctrl+-",
            click: () => setZoomLevel(win, -1)
        })
    );
    viewMenu.append(
        new MenuItem({
            label: "Reset Zoom",
            accelerator: "Ctrl+0",
            click: () => {
                const targetWindow = getMenuTargetWindow(win);
                targetWindow.webContents.setZoomLevel(0);
            }
        })
    );
    viewMenu.append(new MenuItem({ type: "separator" }));
    viewMenu.append(
        new MenuItem({
            label: "Toggle Full Screen",
            accelerator: "F11",
            click: () => {
                const targetWindow = getMenuTargetWindow(win);
                targetWindow.setFullScreen(!targetWindow.isFullScreen());
            }
        })
    );
    viewMenu.append(
        new MenuItem({
            label: "Toggle Developer Tools",
            accelerator: "Ctrl+Shift+I",
            click: () => getMenuTargetWindow(win).webContents.toggleDevTools()
        })
    );

    const runMenu = new Menu();
    runMenu.append(
        new MenuItem({
            label: "Start SKIA Backend",
            click: () => {
                startBackendProcess();
            }
        })
    );
    runMenu.append(
        new MenuItem({
            label: "Stop SKIA Backend",
            click: () => {
                stopBackendProcess();
            }
        })
    );
    runMenu.append(new MenuItem({ type: "separator" }));
    runMenu.append(
        new MenuItem({
            label: "Run Agent Task",
            click: () => {
                mainWindow?.webContents.send("run-agent-task");
            }
        })
    );
    runMenu.append(
        new MenuItem({
            label: "Cancel Task",
            click: () => {
                mainWindow?.webContents.send("run-cancel-task");
            }
        })
    );
    runMenu.append(new MenuItem({ type: "separator" }));
    runMenu.append(
        new MenuItem({
            label: "Open Terminal",
            accelerator: "CmdOrCtrl+`",
            click: () => {
                mainWindow?.webContents.send("open-terminal");
            }
        })
    );

    const windowMenu = new Menu();
    windowMenu.append(
        new MenuItem({
            label: "Minimize",
            accelerator: "Ctrl+M",
            click: () => getMenuTargetWindow(win).minimize()
        })
    );
    windowMenu.append(
        new MenuItem({
            label: "Maximize",
            click: () => getMenuTargetWindow(win).maximize()
        })
    );
    windowMenu.append(
        new MenuItem({
            label: "Close",
            accelerator: "Ctrl+W",
            click: () => getMenuTargetWindow(win).close()
        })
    );
    windowMenu.append(new MenuItem({ type: "separator" }));
    windowMenu.append(new MenuItem({ role: "window" }));

    const helpMenu = new Menu();
    helpMenu.append(
        new MenuItem({
            label: "About SKIA FORGE",
            click: () => {
                showAboutWindow();
            }
        })
    );
    helpMenu.append(new MenuItem({ type: "separator" }));
    helpMenu.append(
        new MenuItem({
            label: "My SKIA Account",
            click: () => { void shell.openExternal("https://skia.ca/dashboard"); }
        })
    );
    helpMenu.append(new MenuItem({ type: "separator" }));
    helpMenu.append(
        new MenuItem({
            label: "Documentation",
            click: () => {
                const docsWin = new BrowserWindow({
                    width: 900,
                    height: 700,
                    title: "SKIA FORGE — Documentation",
                    webPreferences: { contextIsolation: true }
                });
                void docsWin.loadFile(path.join(__dirname, "../renderer/docs/index.html"));
            }
        })
    );
    helpMenu.append(
        new MenuItem({
            label: "Report Abuse or Issue",
            click: () => {
                const reportWin = new BrowserWindow({
                    width: 900,
                    height: 700,
                    title: "SKIA — Report an Issue",
                    webPreferences: { contextIsolation: true }
                });
                void reportWin.loadFile(path.join(__dirname, "../renderer/docs/index.html"));
                reportWin.webContents.on("did-finish-load", () => {
                    void reportWin.webContents.executeJavaScript(
                        `document.getElementById('report')?.scrollIntoView({ behavior: 'instant' });`
                    );
                });
            }
        })
    );
    helpMenu.append(new MenuItem({ type: "separator" }));
    helpMenu.append(
        new MenuItem({
            label: "Release Notes",
            click: () => {
                void openLocalChangelog();
            }
        })
    );
    helpMenu.append(new MenuItem({ type: "separator" }));
    helpMenu.append(
        new MenuItem({
            label: "Toggle Developer Tools",
            click: () => getMenuTargetWindow(win).webContents.toggleDevTools()
        })
    );

    menu.append(
        new MenuItem({
            label: "File",
            submenu: fileMenu
        })
    );
    menu.append(
        new MenuItem({
            label: "Edit",
            submenu: editMenu
        })
    );
    menu.append(
        new MenuItem({
            label: "Selection",
            submenu: selectionMenu
        })
    );
    menu.append(
        new MenuItem({
            label: "View",
            submenu: viewMenu
        })
    );
    menu.append(
        new MenuItem({
            label: "Run",
            submenu: runMenu
        })
    );
    menu.append(
        new MenuItem({
            label: "Window",
            submenu: windowMenu
        })
    );
    menu.append(
        new MenuItem({
            label: "Help",
            submenu: helpMenu
        })
    );

    Menu.setApplicationMenu(menu);
    console.log("SKIA: application menu initialized");
};

const createWindow = (): void => {
    const preloadPath = path.resolve(__dirname, "preload.js");

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        title: "SKIA FORGE",
        icon: path.resolve(__dirname, "../assets/skia-forge-app.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            preload: preloadPath,
            devTools: true
        }
    });

    const rendererPath = path.resolve(__dirname, "../renderer/index.html");
    void mainWindow.loadFile(rendererPath);
    buildApplicationMenu(mainWindow);

    // Open DevTools automatically in development
    // mainWindow.webContents.openDevTools();

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

ipcMain.handle("skia:saveFile", async (_event, filePath: string, content: string): Promise<boolean> => {
    try {
        await fs.writeFile(filePath, content, "utf8");
        return true;
    } catch (error) {
        console.error("SKIA: failed to save file", error);
        return false;
    }
});

ipcMain.handle("skia:saveFileAs", async (_event, content: string): Promise<string | null> => {
    const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const saveDialogOptions = {
        title: "Save File As",
        filters: [{ name: "All Files", extensions: ["*"] }]
    };
    const result = targetWindow
        ? await dialog.showSaveDialog(targetWindow, saveDialogOptions)
        : await dialog.showSaveDialog(saveDialogOptions);

    if (result.canceled || !result.filePath) {
        return null;
    }

    try {
        await fs.writeFile(result.filePath, content, "utf8");
        return result.filePath;
    } catch (error) {
        console.error("SKIA: failed to save file as", error);
        return null;
    }
});

const readDirectoryTree = async (directoryPath: string): Promise<DirTreeNode[]> => {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const sortedEntries = entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
            return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    const nodes: DirTreeNode[] = [];
    for (const entry of sortedEntries) {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            nodes.push({
                name: entry.name,
                path: entryPath,
                type: "directory",
                children: await readDirectoryTree(entryPath)
            });
        } else if (entry.isFile()) {
            nodes.push({
                name: entry.name,
                path: entryPath,
                type: "file"
            });
        }
    }

    return nodes;
};

ipcMain.handle("skia:readFileText", async (_event, filePath: string): Promise<string> => {
    return fs.readFile(filePath, "utf8");
});

ipcMain.handle("skia:readDirectoryTree", async (_event, folderPath: string): Promise<DirTreeNode[]> => {
    return readDirectoryTree(folderPath);
});

ipcMain.on("skia:setAutoSave", (_event, enabled: boolean) => {
    autoSaveEnabled = enabled;
});

ipcMain.handle("skia:runCommand", async (_event, cmd: string, cwd?: string): Promise<{ stdout: string; stderr: string }> => {
    return new Promise((resolve) => {
        exec(
            cmd,
            {
                cwd: cwd || "C:\\SKIA-Forge",
                shell: "powershell.exe"
            },
            (err: ExecException | null, stdout: string, stderr: string) => {
                resolve({
                    stdout: stdout || "",
                    stderr: stderr || err?.message || ""
                });
            }
        );
    });
});

ipcMain.on("open-docs", () => {
    const docsWin = new BrowserWindow({ width: 900, height: 700, title: "SKIA Docs", webPreferences: { contextIsolation: true } });
    void docsWin.loadFile(path.join(__dirname, "../renderer/docs/index.html"));
});

ipcMain.handle("skia:getCookies", async (_event, url: string) => {
    const cookies = await session.defaultSession.cookies.get({ url });
    return cookies.map((c) => ({ name: c.name, value: c.value }));
});

ipcMain.on("open-external", (_event, url: string) => {
    void shell.openExternal(url);
});

app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});