import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { getWorkspacePath } from "./skiaSessionStore";
import { recordTerminalOutput, removeTerminalTranscript } from "./skiaTerminalCapture";

type PtyTab = {
    id: string;
    index: number;
    term: Terminal;
    fit: FitAddon;
    host: HTMLDivElement;
    disposers: Array<() => void>;
};

let tabs: PtyTab[] = [];
let activeId: string | null = null;
let tabCounter = 0;
let ptyDataUnsub: (() => void) | null = null;
let ptyExitUnsub: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;

const getHostEl = (): HTMLElement | null => document.getElementById("terminal-xterm-host");
const getPanelEl = (): HTMLElement | null => document.getElementById("terminal-panel");
const getTabsBarEl = (): HTMLElement | null => document.getElementById("terminal-tabs");

const resolveStartCwd = async (): Promise<string> => {
    try {
        const root = await window.skiaElectron.getProjectRoot();
        if (root && root.trim()) return root.trim();
    } catch {
        /* ignore */
    }
    const w = getWorkspacePath().trim();
    if (w && w !== "browser-workspace") return w;
    return "";
};

const setActiveTab = (id: string): void => {
    activeId = id;
    for (const t of tabs) {
        const on = t.id === id;
        t.host.style.display = on ? "block" : "none";
        if (on) {
            requestAnimationFrame(() => {
                try {
                    t.fit.fit();
                    void window.skiaElectron.ptyResize(t.id, t.term.cols, t.term.rows);
                } catch {
                    /* ignore */
                }
                t.term.focus();
            });
        }
    }
    renderTabButtons();
};

const renderTabButtons = (): void => {
    const bar = getTabsBarEl();
    if (!bar) return;
    bar.innerHTML = "";
    for (const t of tabs) {
        const wrap = document.createElement("div");
        wrap.className = "terminal-tab";
        wrap.dataset.id = t.id;
        if (t.id === activeId) wrap.classList.add("is-active");

        const label = document.createElement("button");
        label.type = "button";
        label.className = "terminal-tab-label";
        label.textContent = `PS ${t.index}`;
        label.title = "Focus this terminal";
        label.addEventListener("click", () => setActiveTab(t.id));

        const del = document.createElement("button");
        del.type = "button";
        del.className = "terminal-tab-delete";
        del.textContent = "×";
        del.title = "Close terminal";
        del.addEventListener("click", (e) => {
            e.stopPropagation();
            void closeTab(t.id);
        });

        wrap.append(label, del);
        bar.appendChild(wrap);
    }
};

const wireGlobalPtyListeners = (): void => {
    if (ptyDataUnsub) return;
    ptyDataUnsub = window.skiaElectron.onPtyData((msg) => {
        if (!msg || typeof msg.id !== "string" || typeof msg.data !== "string") return;
        recordTerminalOutput(msg.id, msg.data);
        const tab = tabs.find((x) => x.id === msg.id);
        if (tab) tab.term.write(msg.data);
    });
    ptyExitUnsub = window.skiaElectron.onPtyExit((msg) => {
        if (!msg || typeof msg.id !== "string") return;
        const tab = tabs.find((x) => x.id === msg.id);
        if (tab) {
            tab.term.writeln(`\r\n\x1b[33m[Process exited with code ${msg.exitCode ?? 0}]\x1b[0m`);
        }
    });
};

const disposeTab = (tab: PtyTab): void => {
    for (const d of tab.disposers) {
        try {
            d();
        } catch {
            /* ignore */
        }
    }
    try {
        tab.term.dispose();
    } catch {
        /* ignore */
    }
    tab.host.remove();
    removeTerminalTranscript(tab.id);
};

const closeTab = async (id: string): Promise<void> => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [removed] = tabs.splice(idx, 1);
    try {
        await window.skiaElectron.ptyKill(removed.id);
    } catch {
        /* ignore */
    }
    disposeTab(removed);
    if (activeId === id) {
        activeId = tabs.length ? tabs[Math.max(0, idx - 1)].id : null;
        if (activeId) setActiveTab(activeId);
    }
    renderTabButtons();
    if (tabs.length === 0 && activeId === null) {
        /* optional: leave panel empty until + */
    }
};

const createTab = async (): Promise<void> => {
    wireGlobalPtyListeners();
    const hostParent = getHostEl();
    if (!hostParent) return;

    tabCounter += 1;
    const index = tabCounter;

    const host = document.createElement("div");
    host.className = "terminal-xterm-layer";
    host.style.display = "none";
    hostParent.appendChild(host);

    const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        // xterm expects a single CSS font-family string
        fontFamily: "\"Centaur\", \"Centaur MT\", serif",
        theme: {
            background: "#050500",
            foreground: "#c9b37a",
            cursor: "#d4af37",
            selectionBackground: "rgba(212,175,55,0.25)"
        }
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    const cwd = await resolveStartCwd();
    let created: { id: string; cwd: string; shell: string };
    try {
        created = await window.skiaElectron.ptyCreate(cwd || undefined);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        term.writeln(`\x1b[31mCould not start integrated terminal (PowerShell PTY).\x1b[0m`);
        term.writeln(msg);
        term.writeln("");
        term.writeln(
            "Windows: install Visual Studio \"Desktop development with C++\", then in skia-ide run:"
        );
        term.writeln("  npm run rebuild:native");
        term.writeln("");
        term.writeln("Until then, use Windows Terminal or PowerShell outside SKIA Forge.");
        const failedId = `failed-${crypto.randomUUID()}`;
        const tab: PtyTab = {
            id: failedId,
            index,
            term,
            fit,
            host,
            disposers: []
        };
        tabs.push(tab);
        setActiveTab(failedId);
        renderTabButtons();
        requestAnimationFrame(() => {
            try {
                fit.fit();
            } catch {
                /* ignore */
            }
            term.focus();
        });
        return;
    }

    const tab: PtyTab = {
        id: created.id,
        index,
        term,
        fit,
        host,
        disposers: []
    };

    const dataSub = term.onData((data) => {
        window.skiaElectron.ptyWrite(created.id, data);
    });
    tab.disposers.push(() => dataSub.dispose());

    tabs.push(tab);
    setActiveTab(created.id);
    renderTabButtons();

    requestAnimationFrame(() => {
        try {
            fit.fit();
            void window.skiaElectron.ptyResize(created.id, term.cols, term.rows);
        } catch {
            /* ignore */
        }
        term.focus();
    });
};

const ensureResizeObserver = (): void => {
    const host = getHostEl();
    if (!host || resizeObserver) return;
    resizeObserver = new ResizeObserver(() => {
        const t = tabs.find((x) => x.id === activeId);
        if (!t) return;
        try {
            t.fit.fit();
            void window.skiaElectron.ptyResize(t.id, t.term.cols, t.term.rows);
        } catch {
            /* ignore */
        }
    });
    resizeObserver.observe(host);
};

export async function ensureTerminalPanelVisible(): Promise<void> {
    const panel = getPanelEl();
    if (!panel) return;
    panel.style.display = "flex";
    ensureResizeObserver();
    wireGlobalPtyListeners();
    if (tabs.length === 0) {
        await createTab();
    } else {
        const t = tabs.find((x) => x.id === activeId) ?? tabs[0];
        setActiveTab(t.id);
    }
}

export async function appendSystemTerminalLine(line: string): Promise<void> {
    await ensureTerminalPanelVisible();
    const t = tabs.find((x) => x.id === activeId) ?? tabs[0];
    if (!t) return;
    t.term.writeln(`\x1b[38;5;214m[SKIA]\x1b[0m ${line}`);
}

export const initSkiaTerminalPanel = (): void => {
    document.getElementById("terminal-close-panel")?.addEventListener("click", () => {
        const panel = getPanelEl();
        if (panel) panel.style.display = "none";
    });

    document.getElementById("terminal-add-tab")?.addEventListener("click", () => {
        void (async () => {
            await ensureTerminalPanelVisible();
            await createTab();
        })();
    });

    window.skiaElectron.onProjectRootChanged((root) => {
        void appendSystemTerminalLine(`Project folder: ${root} (new terminals start here)`);
    });
};
