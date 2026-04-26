type MonacoAction = { run: () => Promise<void> | void };
type MonacoModel = { setValue: (value: string) => void; getValue: () => string };
type MonacoEditor = {
    getAction: (id: string) => MonacoAction | null;
    getModel: () => MonacoModel | null;
    setValue?: (value: string) => void;
    focus: () => void;
};
type MonacoEditorOptions = {
    value: string;
    theme: string;
    language: string;
    fontSize: number;
    fontFamily: string;
    lineNumbers: "on" | "off";
    minimap: { enabled: boolean };
    scrollBeyondLastLine: boolean;
    automaticLayout: boolean;
    tabSize: number;
    insertSpaces: boolean;
    wordWrap: "off" | "on";
    renderWhitespace: "selection" | "all" | "none" | "boundary" | "trailing";
    cursorBlinking: "smooth" | "blink" | "phase" | "expand" | "solid";
    cursorSmoothCaretAnimation: "on" | "off" | "explicit";
    smoothScrolling: boolean;
    padding: { top: number };
};
type MonacoApi = {
    editor: {
        create: (element: HTMLElement, options: MonacoEditorOptions) => MonacoEditor;
        defineTheme: (name: string, theme: {
            base: "vs-dark";
            inherit: boolean;
            rules: Array<{ token: string; foreground: string; fontStyle?: string }>;
            colors: Record<string, string>;
        }) => void;
        setTheme: (name: string) => void;
        setModelLanguage: (model: MonacoModel, language: string) => void;
    };
};
type AmdRequire = {
    (modules: string[], onLoad: (value: unknown) => void): void;
    config: (cfg: { paths: Record<string, string> }) => void;
};

declare global {
    interface Window {
        require?: AmdRequire;
        monaco?: MonacoApi;
    }
}

let editorInstance: MonacoEditor | null = null;

const initialContent =
    "// SKIA Sovereign Intelligence — Development Surface\n" +
    "// One ecosystem. One universe. All SKIA.\n";

const applySkiaTheme = (monaco: MonacoApi): void => {
    monaco.editor.defineTheme("skia-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "comment", foreground: "5a4a1e", fontStyle: "italic" },
            { token: "keyword", foreground: "d4af37" },
            { token: "string", foreground: "8a6f1e" },
            { token: "number", foreground: "c9b37a" },
            { token: "type", foreground: "d4af37", fontStyle: "bold" }
        ],
        colors: {
            "editor.background": "#0a0a0a",
            "editor.foreground": "#c9b37a",
            "editorLineNumber.foreground": "#3a2f0a",
            "editorLineNumber.activeForeground": "#d4af37",
            "editor.selectionBackground": "#2a1f0088",
            "editor.lineHighlightBackground": "#120d0044",
            "editorCursor.foreground": "#d4af37",
            "editorIndentGuide.background": "#2a1f0044",
            "scrollbarSlider.background": "#2a1f0066",
            "scrollbarSlider.hoverBackground": "#d4af3744"
        }
    });
    monaco.editor.setTheme("skia-dark");
};

export const initializeMonaco = (): void => {
    const container = document.getElementById("editor-container");
    if (!container) return;

    const amdRequire = window.require;
    if (!amdRequire) {
        console.error("SKIA: Monaco AMD loader is unavailable");
        return;
    }

    amdRequire(["vs/editor/editor.main"], (loadedMonaco) => {
        const monaco = (loadedMonaco as MonacoApi) ?? window.monaco;
        if (!monaco) {
            console.error("SKIA: Monaco failed to load");
            return;
        }

        applySkiaTheme(monaco);

        editorInstance = monaco.editor.create(container, {
            value: initialContent,
            theme: "vs-dark",
            language: "typescript",
            fontSize: 13,
            fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
            lineNumbers: "on",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: "off",
            renderWhitespace: "selection",
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            smoothScrolling: true,
            padding: { top: 16 }
        });

        monaco.editor.setTheme("skia-dark");
        editorInstance.focus();
        console.log("SKIA: Monaco editor initialized");
    });
};

export const getEditor = (): MonacoEditor | null => editorInstance;