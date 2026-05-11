/**
 * PTY bridge: Windows `powershell.exe` (or POSIX `$SHELL`) per tab, streamed to xterm.js.
 * Native module: after `npm install`, run `npm run rebuild:native` (needs VS C++ build tools on Windows).
 */
import { BrowserWindow, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import type { IPty } from "node-pty";

const sessions = new Map<string, IPty>();

function loadPty(): typeof import("node-pty") | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("node-pty") as typeof import("node-pty");
    } catch {
        return null;
    }
}

const broadcast = (channel: string, payload: unknown): void => {
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, payload);
        }
    }
};

export function registerPtyIpc(resolveCwd: () => string): void {
    ipcMain.handle("skia:pty:create", (_event, cwd?: string) => {
        const pty = loadPty();
        if (!pty) {
            throw new Error(
                "Integrated terminal native module is missing. From the skia-ide folder run: npm run rebuild:native " +
                    "(Windows: install Visual Studio “Desktop development with C++”, then rebuild.)"
            );
        }
        const cwdResolved =
            typeof cwd === "string" && cwd.trim().length > 0 ? cwd.trim() : resolveCwd();
        const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash";
        const shellArgs = process.platform === "win32" ? ["-NoLogo"] : [];
        const id = randomUUID();
        const child = pty.spawn(shell, shellArgs, {
            name: "xterm-256color",
            cols: 100,
            rows: 28,
            cwd: cwdResolved,
            env: process.env as { [key: string]: string | undefined },
            useConpty: process.platform === "win32"
        });
        sessions.set(id, child);
        child.onData((data) => {
            broadcast("skia:pty-data", { id, data });
        });
        child.onExit((ev) => {
            sessions.delete(id);
            broadcast("skia:pty-exit", { id, exitCode: ev.exitCode, signal: ev.signal });
        });
        return { id, cwd: cwdResolved, shell };
    });

    ipcMain.on("skia:pty:write", (_event, id: unknown, data: unknown) => {
        if (typeof id !== "string" || typeof data !== "string") return;
        const t = sessions.get(id);
        if (t) t.write(data);
    });

    ipcMain.on("skia:pty:resize", (_event, id: unknown, cols: unknown, rows: unknown) => {
        if (typeof id !== "string" || typeof cols !== "number" || typeof rows !== "number") return;
        const t = sessions.get(id);
        if (t) t.resize(Math.max(2, Math.floor(cols)), Math.max(1, Math.floor(rows)));
    });

    ipcMain.handle("skia:pty:kill", (_event, id: unknown) => {
        if (typeof id !== "string") return;
        const t = sessions.get(id);
        if (t) {
            try {
                t.kill();
            } catch {
                /* ignore */
            }
            sessions.delete(id);
        }
    });
}

export function killAllPtySessions(): void {
    for (const [, t] of sessions) {
        try {
            t.kill();
        } catch {
            /* ignore */
        }
    }
    sessions.clear();
}
