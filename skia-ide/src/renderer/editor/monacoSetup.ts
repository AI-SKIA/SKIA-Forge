import * as monaco from "monaco-editor";

let editor: monaco.editor.IStandaloneCodeEditor | null = null;

(self as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
  getWorkerUrl: () => "./vs/base/worker/workerMain.js"
};

export const initializeMonaco = (): monaco.editor.IStandaloneCodeEditor => {
  const container = document.getElementById("editor-container");
  if (!container) {
    throw new Error("Editor container not found.");
  }
  container.classList.add("skia-editor");

  monaco.editor.defineTheme("skia-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0a0a0a",
      "editorLineNumber.foreground": "#8e7a40",
      "editorLineNumber.activeForeground": "#d4af37",
      "editorCursor.foreground": "#d4af37",
      "editor.selectionBackground": "#1a1100",
      "editor.inactiveSelectionBackground": "#120d00",
      "editorWidget.background": "#120d00",
      "editorWidget.border": "#2a1f00"
    }
  });

  editor = monaco.editor.create(container, {
    value: "// SKIA IDE ready.\n",
    language: "typescript",
    theme: "skia-dark",
    fontSize: 14,
    fontFamily: "Cascadia Code, Fira Code, monospace",
    minimap: { enabled: true },
    lineNumbers: "on",
    wordWrap: "off",
    automaticLayout: true
  });

  return editor;
};

export const getEditor = (): monaco.editor.IStandaloneCodeEditor | null => editor;

export const openFile = (filePath: string, content: string, language: string): void => {
  if (!editor) {
    throw new Error("Monaco editor is not initialized.");
  }

  const uri = monaco.Uri.parse(`file://${filePath.replace(/\\/g, "/")}`);
  let model = monaco.editor.getModel(uri);
  if (!model) {
    model = monaco.editor.createModel(content, language, uri);
  } else {
    model.setValue(content);
    monaco.editor.setModelLanguage(model, language);
  }
  editor.setModel(model);
};
