// Monaco initialization stubbed out temporarily
// to unblock chat and sidebar functionality
// Will be re-enabled once core interactivity is confirmed working

export const initializeMonaco = (): void => {
    const container = document.getElementById("editor-container");
    if (!container) return;
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.color = "#d4af37";
    container.style.fontSize = "13px";
    container.style.letterSpacing = "0.1em";
    container.innerHTML = "<span>SKIA FORGE — OPEN A PROJECT TO BEGIN</span>";
    console.log("SKIA: editor placeholder initialized");
};

export const getEditor = (): null => null;

export const openFile = (_filePath: string, _content: string, _language: string): void => {
    console.log("SKIA: openFile called but Monaco not yet initialized");
};