import { getMode } from "./skiaApiClient";

const statusEl = document.getElementById("status-text");

const mapMode = (mode: string): { text: string; className?: string } => {
  const normalized = mode.toLowerCase();
  if (normalized.includes("autonomous")) {
    return { text: "SKIA: AUTONOMOUS" };
  }
  if (normalized.includes("adaptive")) {
    return { text: "SKIA: ADAPTIVE" };
  }
  if (normalized.includes("sovereign")) {
    return { text: "SKIA: SOVEREIGN" };
  }
  if (normalized.includes("index")) {
    return { text: "SKIA: INDEXING" };
  }
  return { text: "SKIA: DISCONNECTED" };
};

const render = (mode: string): void => {
  if (!statusEl) {
    return;
  }
  const mapped = mapMode(mode);
  statusEl.textContent = mapped.text;
  statusEl.className = mapped.className ?? "";
};

const resolveMode = async (): Promise<void> => {
  try {
    const result = await getMode();
    const modeValue =
      (result.mode as string | undefined) ??
      (result.currentMode as string | undefined) ??
      "sovereign";
    render(modeValue);
  } catch {
    render("disconnected");
  }
};

export const initializeStatusBar = (): void => {
  void resolveMode();
  setInterval(() => {
    void resolveMode();
  }, 30_000);
};
