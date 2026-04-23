import { getContext } from "./skiaApiClient";
import { setWorkspacePath } from "./skiaSessionStore";

const ONBOARDED_KEY = "skia_onboarded";

const buildOverlay = (): HTMLDivElement => {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(10, 10, 10, 0.9)";
  overlay.style.display = "grid";
  overlay.style.placeItems = "center";
  overlay.style.zIndex = "2000";

  const panel = document.createElement("div");
  panel.style.width = "min(520px, 90vw)";
  panel.style.border = "1px solid #2a1f00";
  panel.style.background = "#120d00";
  panel.style.color = "#d4af37";
  panel.style.padding = "24px";
  panel.style.borderRadius = "2px";
  panel.style.textTransform = "uppercase";
  panel.style.letterSpacing = "0.1em";
  panel.innerHTML = `
    <img src="public/logo.png" alt="SKIA" style="width: 120px; display: block; margin: 0 0 14px;" />
    <p style="margin: 0 0 20px; color: #d4af37; text-transform: none; letter-spacing: 0.03em;">I am SKIA. I see your codebase. Let me understand your architecture.</p>
    <button id="skia-open-project-btn" style="padding: 8px 12px; background: #1a1100; color: #d4af37; border: 1px solid #d4af37; border-radius: 2px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em;">OPEN A PROJECT</button>
  `;

  overlay.appendChild(panel);
  return overlay;
};

export const initializeOnboarding = (): void => {
  if (localStorage.getItem(ONBOARDED_KEY) === "true") {
    return;
  }

  const overlay = buildOverlay();
  document.body.appendChild(overlay);

  const button = document.getElementById("skia-open-project-btn");
  button?.addEventListener("click", async () => {
    const folderPath = await window.skiaElectron.openFolder();
    if (!folderPath) {
      return;
    }

    setWorkspacePath(folderPath);
    try {
      await getContext({ workspacePath: folderPath });
    } catch {
      // Non-blocking onboarding; backend might be offline.
    }

    localStorage.setItem(ONBOARDED_KEY, "true");
    overlay.remove();
  });
};
