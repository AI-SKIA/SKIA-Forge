import { getAuthToken, getLoggedInUser, logout } from "./skiaAuthPanel";

const statusEl = document.getElementById("status-text");
const architectureEl = document.getElementById("status-architecture");

const removeDropdown = (): void => {
  const existing = document.getElementById("skia-status-dropdown");
  if (existing) existing.remove();
};

const createDropdown = (anchor: HTMLElement): void => {
  removeDropdown();
  const rect = anchor.getBoundingClientRect();
  const dropdown = document.createElement("div");
  dropdown.id = "skia-status-dropdown";
  dropdown.style.position = "fixed";
  dropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`;
  dropdown.style.right = "12px";
  dropdown.style.background = "#161616";
  dropdown.style.border = "1px solid #2a2a2a";
  dropdown.style.minWidth = "170px";
  dropdown.style.zIndex = "10000";
  dropdown.style.padding = "6px 0";

  const dashboard = document.createElement("button");
  dashboard.textContent = "Open Dashboard";
  dashboard.style.cssText = "display:block;width:100%;background:none;border:none;color:#e8d5a3;padding:8px 12px;text-align:left;cursor:pointer;";
  dashboard.addEventListener("click", () => {
    window.skiaElectron.openExternal("https://skia.ca/dashboard");
    removeDropdown();
  });

  const signOut = document.createElement("button");
  signOut.textContent = "Sign Out";
  signOut.style.cssText = "display:block;width:100%;background:none;border:none;color:#e8d5a3;padding:8px 12px;text-align:left;cursor:pointer;";
  signOut.addEventListener("click", () => {
    logout();
    location.reload();
  });

  dropdown.append(dashboard, signOut);
  document.body.appendChild(dropdown);
};

const render = (): void => {
  if (!statusEl) return;
  const user = getLoggedInUser();
  if (!user?.email) {
    statusEl.textContent = "⬡ SKIA: DISCONNECTED";
    if (architectureEl) architectureEl.textContent = "";
    return;
  }

  statusEl.textContent = "⬡ SKIA: CONNECTED";
  if (!architectureEl) return;

  architectureEl.innerHTML = "";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = `${user.email}  [↓]`;
  trigger.style.cssText = "margin-left:10px;background:none;border:none;color:#e8d5a3;cursor:pointer;";
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = Boolean(document.getElementById("skia-status-dropdown"));
    if (open) {
      removeDropdown();
    } else {
      createDropdown(trigger);
    }
  });
  architectureEl.appendChild(trigger);
};

const pollArchitectureHealth = async (): Promise<void> => {
  try {
    const token = getAuthToken();
    const response = await fetch("https://api.skia.ca/api/forge/architecture/health", {
      method: "GET",
      headers: {
        Origin: "https://skia.ca",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) {
      return;
    }
    // Parsed intentionally for side-effect validation; failures are silenced.
    await response.json();
  } catch {
    // Offline/unreachable should be silent.
  }
};

export const initializeStatusBar = (): void => {
  render();
  void pollArchitectureHealth();
  window.setInterval(() => {
    void pollArchitectureHealth();
  }, 10_000);
  window.addEventListener("skia-auth-ready", render as EventListener);
  window.addEventListener("skia-auth-logout", render as EventListener);
  document.addEventListener("click", () => removeDropdown());
};
