import { getArchitectureHealth, getMode } from "./skiaApiClient";

const statusEl = document.getElementById("status-text");
const architectureEl = document.getElementById("status-architecture");

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

const renderArchitecture = (score: number): void => {
  if (!architectureEl) return;
  architectureEl.textContent = `ARCH: ${score}`;
  architectureEl.className = score > 80 ? "arch-green" : score >= 60 ? "arch-yellow" : "arch-red";
  architectureEl.setAttribute("style", `margin-left:10px;color:${score > 80 ? "#2ecc71" : score >= 60 ? "#f1c40f" : "#e74c3c"};`);
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

const resolveArchitectureHealth = async (): Promise<void> => {
  try {
    const result = await getArchitectureHealth();
    const score = Number((result.overall as number | undefined) ?? (result.score as number | undefined) ?? 78);
    renderArchitecture(score);
  } catch {
    renderArchitecture(0);
  }
};

export const initializeStatusBar = (): void => {
  void resolveMode();
  void resolveArchitectureHealth();
  setInterval(() => {
    void resolveMode();
    void resolveArchitectureHealth();
  }, 30_000);
};
