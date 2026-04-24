import "./styles/app.css";
import "./styles/skia-dark.css";
import { initializeMonaco } from "./editor/monacoSetup";
import { loadConfig } from "./skia/skiaConfig";
import { initializeChatPanel } from "./skia/skiaChatPanel";
import { initializeStatusBar } from "./skia/skiaStatusBar";
import { initializeOnboarding } from "./skia/skiaOnboarding";
import { getMode, getGovernance, getModulesStatus } from "./skia/skiaApiClient";

const loadForgeStatus = async (): Promise<void> => {
    const modeEl = document.getElementById("forge-mode");
    const govEl = document.getElementById("forge-governance");
    const modEl = document.getElementById("forge-modules");

    if (modeEl) modeEl.textContent = "Loading...";
    if (govEl) govEl.textContent = "";
    if (modEl) modEl.textContent = "";

    try {
        const [mode, gov, modules] = await Promise.all([
            getMode(),
            getGovernance(),
            getModulesStatus()
        ]);

        if (modeEl) {
            modeEl.innerHTML = `
                <div class="forge-row">
                    <span class="forge-label">MODE</span>
                    <span class="forge-value">${String(mode.mode ?? mode.currentMode ?? "sovereign")}</span>
                </div>`;
        }
        if (govEl) {
            govEl.innerHTML = `
                <div class="forge-row">
                    <span class="forge-label">GOVERNANCE</span>
                    <span class="forge-value">${JSON.stringify(gov, null, 2)}</span>
                </div>`;
        }
        if (modEl) {
            modEl.innerHTML = `
                <div class="forge-row">
                    <span class="forge-label">MODULES</span>
                    <span class="forge-value">${JSON.stringify(modules, null, 2)}</span>
                </div>`;
        }
    } catch {
        if (modeEl) {
            modeEl.innerHTML = `<div class="forge-row"><span class="forge-value" style="color:#8a6f1e">Backend unavailable — start SKIA-Forge with npm run dev</span></div>`;
        }
    }
};

const loadSettings = (): void => {
    const urlInput = document.getElementById("settings-backend-url") as HTMLInputElement | null;
    const tokenInput = document.getElementById("settings-auth-token") as HTMLInputElement | null;
    const saveBtn = document.getElementById("settings-save-btn");

    if (urlInput) {
        urlInput.value = localStorage.getItem("skia_backend_url") ?? "http://127.0.0.1:3000";
    }
    if (tokenInput) {
        tokenInput.value = localStorage.getItem("skia_auth_token") ?? "";
    }

    if (saveBtn) {
        const newBtn = saveBtn.cloneNode(true) as HTMLButtonElement;
        saveBtn.parentNode?.replaceChild(newBtn, saveBtn);
        newBtn.addEventListener("click", () => {
            if (urlInput) localStorage.setItem("skia_backend_url", urlInput.value);
            if (tokenInput) localStorage.setItem("skia_auth_token", tokenInput.value);
            newBtn.textContent = "SAVED";
            setTimeout(() => { newBtn.textContent = "SAVE"; }, 2000);
        });
    }
};

const initializeSidebarNavigation = (): void => {
    console.log("SKIA: initializeSidebarNavigation called");

    const navItems = Array.from(
        document.querySelectorAll<HTMLElement>("#skia-nav .nav-item")
    );

    console.log(`SKIA: found ${navItems.length} nav items`);

    const viewMap: Record<string, string> = {
        explorer: "editor-container",
        search: "view-search",
        agent: "view-agent",
        forge: "view-forge",
        settings: "view-settings"
    };

    const setView = (view: string): void => {
        console.log(`SKIA: setView called with: ${view}`);

        // Update nav active state
        navItems.forEach((item) => {
            item.classList.toggle("is-active", item.dataset.view === view);
        });

        // Hide ALL center views by setting display none directly
        Object.values(viewMap).forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = "none";
                el.classList.remove("active");
            }
        });

        // Show target view
        const targetId = viewMap[view] ?? "editor-container";
        const target = document.getElementById(targetId);
        if (target) {
            target.style.display = "flex";
            target.classList.add("active");
            console.log(`SKIA: showing view: ${targetId}`);
        } else {
            console.error(`SKIA: view element not found: ${targetId}`);
        }

        if (view === "forge") void loadForgeStatus();
        if (view === "settings") loadSettings();
    };

    // Attach click listeners
    navItems.forEach((item) => {
        const view = item.dataset.view ?? "explorer";
        console.log(`SKIA: attaching click to nav item: ${view}`);
        item.addEventListener("click", () => {
            console.log(`SKIA: nav item clicked: ${view}`);
            setView(view);
        });
    });

    // Set initial view
    setView("explorer");
};

const bootstrap = async (): Promise<void> => {
    console.log("SKIA: bootstrap starting");
    await loadConfig();
    console.log("SKIA: config loaded");
    initializeMonaco();
    console.log("SKIA: monaco initialized");
    initializeSidebarNavigation();
    console.log("SKIA: sidebar navigation initialized");
    initializeChatPanel();
    console.log("SKIA: chat panel initialized");
    initializeStatusBar();
    console.log("SKIA: status bar initialized");
    initializeOnboarding();
    console.log("SKIA: onboarding initialized");
    console.log("SKIA: bootstrap complete");
};

void bootstrap();