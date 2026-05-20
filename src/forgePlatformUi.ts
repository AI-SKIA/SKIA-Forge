import { forgeDownloadAppLink, forgeDownloadClientGateScript } from "./utils/forgeDownloadMarkup.js";

export function renderForgePlatformHtml(): string {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SKIA Forge | Execution Platform</title>
  <style>
    :root {
      --bg: #080400;
      --panel: linear-gradient(135deg, rgba(15, 8, 0, 0.95) 0%, rgba(25, 14, 0, 0.95) 100%);
      --line: rgba(212, 175, 55, 0.22);
      --text: #f1e2ad;
      --muted: rgba(255, 255, 255, 0.62);
      --gold: #d4af37;
      --font-heading: "Space Grotesk", "Sora", system-ui, sans-serif;
      --font-body: "Inter", "SF Pro Display", system-ui, sans-serif;
      --tracking-heading: 0.06em;
      --tracking-heading-display: 0.08em;
      --tracking-body: 0.01em;
      --line-heading: 1.12;
      --line-body: 1.6;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255, 180, 0, 0.06) 0%, transparent 70%), var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      height: 100dvh;
      overflow: hidden;
      line-height: var(--line-body);
      letter-spacing: var(--tracking-body);
    }

    /* SKIA dashboard scrollbar style */
    *::-webkit-scrollbar { width: 6px; height: 6px; }
    *::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.35); }
    *::-webkit-scrollbar-thumb {
      background: rgba(212, 175, 55, 0.45);
      border-radius: 4px;
      border: 1px solid rgba(212, 175, 55, 0.25);
    }
    *::-webkit-scrollbar-thumb:hover { background: rgba(212, 175, 55, 0.75); }

    .topbar {
      height: 58px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(4px);
    }
    .brand {
      display: flex;
      align-items: center;
      color: var(--gold);
      letter-spacing: var(--tracking-heading-display);
      font-size: 20px;
      font-family: var(--font-heading);
      font-weight: 700;
      text-transform: uppercase;
    }
    .brand-logo {
      height: 28px;
      width: auto;
      vertical-align: middle;
      margin-right: 8px;
      flex-shrink: 0;
    }
    .status { color: var(--muted); font-size: 12px; letter-spacing: var(--tracking-heading-display); text-transform: uppercase; font-family: var(--font-heading); font-weight: 600; line-height: 1.15; }
    .download-btn {
      text-decoration: none;
      color: var(--gold);
      border: 1px solid rgba(212, 175, 55, 0.4);
      background: rgba(212, 175, 55, 0.08);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      letter-spacing: var(--tracking-heading-display);
      text-transform: uppercase;
      font-family: var(--font-heading);
      font-weight: 600;
    }
    .download-btn:hover {
      background: rgba(212, 175, 55, 0.16);
      border-color: rgba(212, 175, 55, 0.7);
    }
    .auth-banner {
      display: none;
      margin: 0 16px 8px;
      padding: 10px 14px;
      border: 1px solid rgba(251, 113, 133, 0.45);
      border-radius: 8px;
      background: rgba(40, 8, 12, 0.55);
      color: rgba(255, 220, 220, 0.92);
      font-size: 12px;
      line-height: 1.5;
    }
    .auth-banner.visible { display: block; }
    .auth-banner a { color: var(--gold); }

    .root {
      height: calc(100dvh - 58px);
      display: grid;
      grid-template-columns: 280px 1fr;
    }
    .left { border-right: 1px solid var(--line); background: rgba(0, 0, 0, 0.4); overflow: auto; }
    .main {
      display: grid;
      grid-template-rows: auto auto 1fr;
      gap: 12px;
      padding: 16px;
      overflow: hidden;
    }
    .section-title { color: var(--gold); padding: 12px; border-bottom: 1px solid var(--line); font-size: 12px; letter-spacing: var(--tracking-heading-display); text-transform: uppercase; font-family: var(--font-heading); font-weight: 600; }
    .mod-list { padding: 10px; display: grid; gap: 8px; }
    .mod-btn {
      width: 100%;
      text-align: left;
      background: transparent;
      color: var(--muted);
      border: 1px solid rgba(212, 175, 55, 0.16);
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      font-family: var(--font-heading);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: var(--tracking-heading);
      text-transform: uppercase;
    }
    .mod-btn:hover, .mod-btn.active {
      color: var(--gold);
      border-color: rgba(212, 175, 55, 0.55);
      background: rgba(212, 175, 55, 0.08);
    }

    .hero {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      padding: 14px;
    }
    .hero h1 {
      margin: 0 0 6px;
      font-size: 18px;
      color: var(--gold);
      letter-spacing: var(--tracking-heading-display);
      text-transform: uppercase;
      font-family: var(--font-heading);
      font-weight: 700;
    }
    .hero p {
      margin: 0;
      color: var(--muted);
      font-family: var(--font-body);
      font-size: 14px;
      letter-spacing: var(--tracking-body);
      line-height: var(--line-body);
    }

    .composer {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.42);
      padding: 12px;
      display: grid;
      gap: 8px;
    }
    .label {
      color: var(--gold);
      font-size: 11px;
      letter-spacing: var(--tracking-heading-display);
      text-transform: uppercase;
      font-family: var(--font-heading);
      font-weight: 600;
    }
    .textarea {
      width: 100%;
      min-height: 110px;
      resize: vertical;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(212, 175, 55, 0.25);
      border-radius: 8px;
      color: #f5e8bc;
      padding: 10px;
      font-family: var(--font-body);
      font-size: 14px;
      letter-spacing: var(--tracking-body);
    }
    .textarea:focus { outline: none; border-color: rgba(212, 175, 55, 0.6); }

    .controls { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn {
      padding: 9px 14px;
      border-radius: 8px;
      border: 1px solid rgba(212, 175, 55, 0.35);
      background: rgba(212, 175, 55, 0.08);
      color: var(--gold);
      cursor: pointer;
      font-size: 11px;
      letter-spacing: var(--tracking-heading-display);
      text-transform: uppercase;
      font-family: var(--font-heading);
      font-weight: 600;
    }
    .btn:hover { border-color: rgba(212, 175, 55, 0.7); background: rgba(212, 175, 55, 0.16); }

    .output {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.4);
      padding: 12px;
      overflow: auto;
      min-height: 220px;
      white-space: pre-wrap;
      font-family: var(--font-body);
      font-size: 13px;
      color: rgba(255, 255, 255, 0.86);
      line-height: var(--line-body);
      letter-spacing: var(--tracking-body);
    }

    .result {
      border: 1px solid rgba(212, 175, 55, 0.22);
      border-radius: 8px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.45);
      color: var(--muted);
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 34vh;
      overflow: auto;
    }

    @media (max-width: 980px) {
      .root { grid-template-columns: 1fr; }
      .left { display: none; }
    }
    @media (max-width: 560px) {
      .status { display: none; }
      .brand { font-size: 16px; }
      .download-btn { font-size: 10px; padding: 7px 9px; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">
      <img src="/sidebar-logo.png" alt="Skia" height="28" class="brand-logo" />
      SKIA FORGE IDE
    </div>
    <div class="status" id="integrationStatus">Integration: checking...</div>
    ${forgeDownloadAppLink("download-btn")}
  </div>
  <div id="authBanner" class="auth-banner" role="alert"></div>
  <div class="root">
    <aside class="left">
      <div class="section-title">IDE Modules</div>
      <div class="mod-list">
        <button class="mod-btn active" data-module="agent">Agent</button>
        <button class="mod-btn" data-module="context">Context</button>
        <button class="mod-btn" data-module="sdlc">SDLC</button>
        <button class="mod-btn" data-module="production">Production</button>
        <button class="mod-btn" data-module="healing">Healing</button>
        <button class="mod-btn" data-module="architecture">Architecture</button>
        <button class="mod-btn" data-module="orchestrate">Lifecycle Orchestrate</button>
      </div>
    </aside>
    <main class="main">
      <section class="hero">
        <h1>SKIA Forge</h1>
        <p>Select an execution mode and submit your task — SKIA returns governed, structured output.</p>
      </section>
      <section class="composer">
        <div class="label">Prompt</div>
        <textarea id="prompt" class="textarea" placeholder="Describe what you want Forge to do..."></textarea>
        <div class="controls">
          <button class="btn" id="runModule">Run Selected Module</button>
          <button class="btn" id="runOrchestration">Run Full Lifecycle</button>
          <button class="btn" id="checkHealth">Check Module Health</button>
        </div>
      </section>
      <section class="output" id="mainOutput">Ready.</section>
      <div class="result" id="metaOutput">No diagnostics yet.</div>
    </main>
  </div>
  <script>
    const integrationStatus = document.getElementById("integrationStatus");
    const authBanner = document.getElementById("authBanner");
    const mainOutput = document.getElementById("mainOutput");
    const metaOutput = document.getElementById("metaOutput");
    const moduleButtons = Array.from(document.querySelectorAll(".mod-btn"));
    let activeModule = "agent";
    let _forgeToken = null;

    function authHeaders() {
      return _forgeToken
        ? { "Content-Type": "application/json", "Authorization": "Bearer " + _forgeToken }
        : { "Content-Type": "application/json" };
    }

    function showAuthError(message) {
      integrationStatus.textContent = "SKIA INTEGRATION UNAVAILABLE — " + message;
      if (authBanner) {
        authBanner.innerHTML =
          message +
          ' <a href="https://skia.ca/login" target="_blank" rel="noopener noreferrer">Log in at skia.ca</a>, then reload this page.';
        authBanner.classList.add("visible");
      }
    }

    async function bootstrapForgeSession() {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include"
        });
        if (!res.ok) {
          showAuthError("Session expired or not logged in. Please log in at skia.ca first.");
          return;
        }
        const data = await res.json();
        _forgeToken = data.token ?? null;
        if (!_forgeToken) {
          showAuthError("No token returned. Please log in at skia.ca first.");
        } else if (authBanner) {
          authBanner.classList.remove("visible");
          authBanner.textContent = "";
        }
      } catch {
        showAuthError("Could not reach auth service.");
      }
    }

    const moduleDescriptions = {
      agent:        { title: "Agent",                 desc: "Run an autonomous agent task — SKIA plans, reasons, and executes steps to complete your goal." },
      context:      { title: "Context",               desc: "Analyze and load context from your codebase or inputs — SKIA builds a structured understanding before acting." },
      sdlc:         { title: "SDLC",                  desc: "Run a software delivery lifecycle task — from spec to implementation, governed end-to-end." },
      production:   { title: "Production",            desc: "Execute production-grade operations — deployments, releases, and runtime governance." },
      healing:      { title: "Healing",               desc: "Diagnose and remediate issues — SKIA identifies failures and applies structured recovery." },
      architecture: { title: "Architecture",          desc: "Analyze or evolve your system architecture — SKIA enforces rules and surfaces structural insights." },
      orchestrate:  { title: "Lifecycle Orchestrate", desc: "Run the full lifecycle pipeline — agent, context, SDLC, production, healing, and architecture in sequence." }
    };

    function setActiveModule(next) {
      activeModule = next;
      moduleButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.module === next));
      const info = moduleDescriptions[next] || { title: next, desc: "Select a prompt and run this module." };
      document.querySelector(".hero h1").textContent = info.title;
      document.querySelector(".hero p").textContent = info.desc;
    }

    moduleButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveModule(btn.dataset.module || "agent");
      });
    });

    async function refreshIntegration() {
      try {
        const [integrationRes, modeRes] = await Promise.all([
          fetch("/integration/skia-full", { headers: authHeaders() }),
          fetch("/api/forge/mode", { headers: authHeaders() })
        ]);

        if (integrationRes.status === 401 || modeRes.status === 401) {
          integrationStatus.textContent = "SKIA INTEGRATION UNAVAILABLE — not authenticated";
          return;
        }

        const integrationData = await integrationRes.json();
        integrationStatus.textContent = integrationData.enabled
          ? "SKIA CONNECTED"
          : "SKIA INTEGRATION UNAVAILABLE";
      } catch {
        integrationStatus.textContent = "SKIA INTEGRATION UNAVAILABLE";
      }
    }

    function requireAuthForAction() {
      if (_forgeToken) return true;
      mainOutput.textContent = "Not authenticated. Log in at skia.ca and reload this page.";
      return false;
    }

    async function runSelectedModule() {
      if (!requireAuthForAction()) return;
      const prompt = String(document.getElementById("prompt").value || "").trim();
      if (!prompt) {
        mainOutput.textContent = "Add a prompt first.";
        return;
      }
      mainOutput.textContent = "Running " + activeModule + "...";
      try {
        if (activeModule === "orchestrate") {
          const res = await fetch("/api/forge/orchestrate", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ intent: prompt, mode: "adaptive", approved: false })
          });
          if (res.status === 401) {
            mainOutput.textContent = "Session expired. Log in at skia.ca and reload this page.";
            return;
          }
          const data = await res.json();
          mainOutput.textContent = JSON.stringify(data, null, 2);
          metaOutput.textContent = "Orchestration complete (" + res.status + ").";
          return;
        }

        const res = await fetch("/api/forge/module/" + activeModule, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ query: prompt, task: prompt, mode: "adaptive", approved: false })
        });
        if (res.status === 401) {
          mainOutput.textContent = "Session expired. Log in at skia.ca and reload this page.";
          return;
        }
        const data = await res.json();
        mainOutput.textContent = JSON.stringify(data, null, 2);
        metaOutput.textContent = "Module " + activeModule + " complete (" + res.status + ").";
      } catch (error) {
        mainOutput.textContent = "Request failed.";
        metaOutput.textContent = String(error);
      }
    }

    async function runOrchestration() {
      if (!requireAuthForAction()) return;
      const prompt = String(document.getElementById("prompt").value || "").trim();
      if (!prompt) {
        mainOutput.textContent = "Add a prompt first.";
        return;
      }
      mainOutput.textContent = "Running lifecycle orchestration...";
      try {
        const res = await fetch("/api/forge/orchestrate", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ intent: prompt, mode: "adaptive", approved: false })
        });
        if (res.status === 401) {
          mainOutput.textContent = "Session expired. Log in at skia.ca and reload this page.";
          return;
        }
        const data = await res.json();
        mainOutput.textContent = JSON.stringify(data, null, 2);
        metaOutput.textContent = "Lifecycle complete (" + res.status + ").";
      } catch (error) {
        mainOutput.textContent = "Lifecycle run failed.";
        metaOutput.textContent = String(error);
      }
    }

    async function checkHealth() {
      if (!requireAuthForAction()) return;
      metaOutput.textContent = "Checking health...";
      try {
        const res = await fetch("/api/forge/modules/status", { headers: authHeaders() });
        if (res.status === 401) {
          metaOutput.textContent = "Not authenticated.";
          return;
        }
        const data = await res.json();
        metaOutput.textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        metaOutput.textContent = String(error);
      }
    }

    document.getElementById("runModule").addEventListener("click", runSelectedModule);
    document.getElementById("runOrchestration").addEventListener("click", runOrchestration);
    document.getElementById("checkHealth").addEventListener("click", checkHealth);

    async function init() {
      await bootstrapForgeSession();
      if (!_forgeToken) return;
      await refreshIntegration();
    }

    document.addEventListener("DOMContentLoaded", init);
  </script>
  ${forgeDownloadClientGateScript()}
</body>
</html>`;
}