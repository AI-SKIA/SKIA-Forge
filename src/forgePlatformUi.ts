import { forgeDownloadAppLink, forgeDownloadClientGateScript } from "./utils/forgeDownloadMarkup.js";

export function renderForgePlatformHtml(): string {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title data-i18n="forge-platform.meta.title">SKIA Forge | Execution Platform</title>
  <link rel="stylesheet" href="/forge-premium-ui.css" />
  <script src="/forge-document-locale.js"></script>
  <style>
    :root {
      --bg: #0a0a0a;
      --panel: #1a1a1a;
      --line: rgba(212, 175, 55, 0.3);
      --text: #ffffff;
      --muted: rgba(255, 255, 255, 0.55);
      --gold: #d4af37;
      --gold-accent: rgba(212, 175, 55, 0.7);
      --card: #111111;
      --danger: #ff5c5c;
      --font-heading: "Agency FB", "AgencyFB", sans-serif;
      --font-body: "Centaur", "Centaur MT", serif;
      --tracking-heading: 0.06em;
      --tracking-heading-display: 0.08em;
      --tracking-body: 0.01em;
      --line-heading: 1.12;
      --line-body: 1.6;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: "Centaur", "Centaur MT", serif;
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
    *::-webkit-scrollbar-thumb:hover { background: var(--gold-accent); }

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
      font-size: 28px;
      font-family: "Agency FB", "AgencyFB", sans-serif;
      font-weight: 400;
      text-transform: uppercase;
    }
    .brand-logo {
      height: 28px;
      width: auto;
      vertical-align: middle;
      margin-right: 8px;
      flex-shrink: 0;
    }
    .status { color: var(--muted); font-size: 12px; letter-spacing: var(--tracking-heading-display); text-transform: uppercase; font-family: "Agency FB", "AgencyFB", sans-serif; font-weight: 400; line-height: 1.15; }
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
      font-family: "Agency FB", "AgencyFB", sans-serif;
      font-weight: 400;
    }
    .download-btn:hover {
      background: rgba(212, 175, 55, 0.16);
      border-color: #d4af37;
    }
    .auth-banner {
      display: none;
      margin: 0 16px 8px;
      padding: 10px 14px;
      border: 1px solid rgba(255, 92, 92, 0.45);
      border-radius: 8px;
      background: rgba(255, 92, 92, 0.12);
      color: var(--danger);
      font-size: 12px;
      font-weight: 400;
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
    .section-title { color: var(--gold); padding: 12px; border-bottom: 1px solid var(--line); font-size: 10px; letter-spacing: var(--tracking-heading-display); text-transform: uppercase; font-family: "Agency FB", "AgencyFB", sans-serif; font-weight: 400; }
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
      font-family: "Agency FB", "AgencyFB", sans-serif;
      font-size: 12px;
      font-weight: 400;
      letter-spacing: var(--tracking-heading);
      text-transform: uppercase;
    }
    .mod-btn:hover, .mod-btn.active {
      color: var(--gold);
      border-color: #d4af37;
      background: rgba(212, 175, 55, 0.08);
    }
    a.mod-btn {
      display: block;
      text-decoration: none;
      text-align: left;
    }
    .mod-btn-home {
      margin-top: 4px;
      color: var(--gold);
      border-color: #d4af37;
    }

    .hero {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      padding: 14px;
    }
    .hero h1 {
      margin: 0 0 6px;
      font-size: 24px;
      color: var(--gold);
      letter-spacing: var(--tracking-heading-display);
      text-transform: uppercase;
      font-family: "Agency FB", "AgencyFB", sans-serif;
      font-weight: 400;
    }
    .hero p {
      margin: 0;
      color: var(--muted);
      font-family: "Centaur", "Centaur MT", serif;
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
      font-family: "Agency FB", "AgencyFB", sans-serif;
      font-weight: 400;
    }
    .textarea {
      width: 100%;
      min-height: 110px;
      resize: vertical;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(212, 175, 55, 0.25);
      border-radius: 8px;
      color: var(--text);
      padding: 10px;
      font-family: "Centaur", "Centaur MT", serif;
      font-size: 14px;
      letter-spacing: var(--tracking-body);
    }
    .textarea:focus { outline: none; border-color: #d4af37; }

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
      font-family: "Agency FB", "AgencyFB", sans-serif;
      font-weight: 400;
    }
    .btn:hover { border-color: #d4af37; background: rgba(212, 175, 55, 0.16); }

    .output {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.4);
      padding: 12px;
      overflow: auto;
      min-height: 220px;
      white-space: pre-wrap;
      font-family: "Centaur", "Centaur MT", serif;
      font-size: 14px;
      color: var(--text);
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
      .brand { font-size: 24px; }
      .download-btn { font-size: 10px; padding: 7px 9px; }
    }
  </style>
  <script src="/forge-skia-sso.js"></script>
</head>
<body data-forge-i18n-page="forge-platform">
  <div class="topbar">
    <div class="brand">
      <img src="/sidebar-logo.png" alt="Skia" height="28" class="brand-logo" />
      <span data-i18n="forge-platform.header.brand">SKIA FORGE IDE</span>
    </div>
    <div class="status" id="integrationStatus" data-i18n="forge-platform.header.statusChecking">Integration: checking...</div>
    ${forgeDownloadAppLink('download-btn', 'DOWNLOAD SKIA FORGE', '/api/app/download', 'forge-platform.header.download')}
  </div>
  <div id="authBanner" class="auth-banner" role="alert"></div>
  <div class="root">
    <aside class="left">
      <div class="section-title" data-i18n="forge-platform.sidebar.title">IDE Modules</div>
      <div class="mod-list">
        <button class="mod-btn active" data-module="agent" data-i18n="forge-platform.modules.agent.label">Agent</button>
        <button class="mod-btn" data-module="context" data-i18n="forge-platform.modules.context.label">Context</button>
        <button class="mod-btn" data-module="sdlc" data-i18n="forge-platform.modules.sdlc.label">SDLC</button>
        <button class="mod-btn" data-module="production" data-i18n="forge-platform.modules.production.label">Production</button>
        <button class="mod-btn" data-module="healing" data-i18n="forge-platform.modules.healing.label">Healing</button>
        <button class="mod-btn" data-module="architecture" data-i18n="forge-platform.modules.architecture.label">Architecture</button>
        <button class="mod-btn" data-module="orchestrate" data-i18n="forge-platform.modules.orchestrate.label">Lifecycle Orchestrate</button>
        <a class="mod-btn mod-btn-home" id="forgeHomeLink" href="/platform-downloads" data-i18n="forge-platform.sidebar.forgeHome">Forge Home</a>
      </div>
    </aside>
    <main class="main">
      <section class="hero">
        <h1 data-i18n="forge-platform.hero.defaultTitle">SKIA Forge</h1>
        <p data-i18n="forge-platform.hero.subtitle">Select an execution mode and submit your task — SKIA returns governed, structured output.</p>
      </section>
      <section class="composer">
        <div class="label" data-i18n="forge-platform.composer.label">Prompt</div>
        <textarea id="prompt" class="textarea" data-i18n-placeholder="forge-platform.composer.placeholder" placeholder="Describe what you want Forge to do..."></textarea>
        <div class="controls">
          <button class="btn" id="runModule" data-i18n="forge-platform.composer.runModule">Run Selected Module</button>
          <button class="btn" id="runOrchestration" data-i18n="forge-platform.composer.runLifecycle">Run Full Lifecycle</button>
          <button class="btn" id="checkHealth" data-i18n="forge-platform.composer.checkHealth">Check Module Health</button>
        </div>
      </section>
      <section class="output" id="mainOutput" data-i18n="forge-platform.output.ready">Ready.</section>
      <div class="result" id="metaOutput" data-i18n="forge-platform.output.noDiagnostics">No diagnostics yet.</div>
    </main>
  </div>
  <script src="/forge-page-locale.js" defer></script>
  <script defer>
    const integrationStatus = document.getElementById("integrationStatus");
    const authBanner = document.getElementById("authBanner");
    const mainOutput = document.getElementById("mainOutput");
    const metaOutput = document.getElementById("metaOutput");
    const moduleButtons = Array.from(document.querySelectorAll(".mod-btn"));
    let activeModule = "agent";
    let _forgeToken = null;
    let fpMessages = null;

    function fp(path) {
      const parts = path.split(".");
      let cur = fpMessages;
      for (const part of parts) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = cur[part];
      }
      return typeof cur === "string" ? cur : undefined;
    }

    function fpFormat(path, vars) {
      let text = fp(path) || path;
      if (vars) {
        for (const [key, value] of Object.entries(vars)) {
          text = text.replace(new RegExp("{{" + key + "}}", "g"), String(value));
        }
      }
      return text;
    }

    function loadForgePlatformMessages() {
      fpMessages = (window.__forgeI18n && window.__forgeI18n["forge-platform"]) || null;
    }

    function forgeLocalePrefix() {
      const match = window.location.pathname.match(/^\\/([a-z]{2})(\\/|$)/);
      return match ? "/" + match[1] : "";
    }

    function forgeHomeHref() {
      return forgeLocalePrefix() + "/platform-downloads";
    }

    const FORGE_SESSION_TOKEN_KEY = "skia_session_token";

    function buildHandoffReturnUrl() {
      const url = new URL(window.location.href);
      for (const key of ["token", "accessToken", "access_token", "jwt"]) {
        url.searchParams.delete(key);
      }
      return url.origin + url.pathname + url.search;
    }

    const SKIA_FORGE_BRIDGE = "https://skia.ca/api/auth/forge-bridge?returnTo=";

    function redirectToSkiaHandoff() {
      const returnTo = encodeURIComponent(buildHandoffReturnUrl());
      window.location.replace(SKIA_FORGE_BRIDGE + returnTo);
    }

    function buildSkiaLoginUrl() {
      const returnTo = encodeURIComponent(buildHandoffReturnUrl());
      return SKIA_FORGE_BRIDGE + returnTo;
    }

    function isArrivingFromSkiaSite() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("skia_sso") === "1") return true;
      try {
        return (document.referrer || "").includes("skia.ca");
      } catch {
        return false;
      }
    }

    function readStoredForgeToken() {
      try {
        return sessionStorage.getItem(FORGE_SESSION_TOKEN_KEY);
      } catch {
        return null;
      }
    }

    function persistForgeToken(token) {
      if (!token) return;
      try {
        sessionStorage.setItem(FORGE_SESSION_TOKEN_KEY, token);
      } catch {}
      _forgeToken = token;
    }

    function readTokenFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(
        (window.location.hash || "").replace(/^#/, "")
      );
      for (const source of [params, hash]) {
        for (const key of ["token", "accessToken", "access_token", "jwt"]) {
          const value = source.get(key);
          if (value && value.trim()) return value.trim();
        }
      }
      return null;
    }

    function scrubTokenFromUrl() {
      const url = new URL(window.location.href);
      let dirty = false;
      for (const key of ["token", "accessToken", "access_token", "jwt"]) {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          dirty = true;
        }
      }
      if (url.hash) {
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        for (const key of ["token", "accessToken", "access_token", "jwt"]) {
          if (hash.has(key)) {
            hash.delete(key);
            dirty = true;
          }
        }
        const nextHash = hash.toString();
        url.hash = nextHash ? "#" + nextHash : "";
      }
      if (!dirty) return;
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }

    function extractTokenFromPayload(payload) {
      if (!payload || typeof payload !== "object") return null;
      for (const key of ["token", "jwt", "accessToken", "access_token"]) {
        if (typeof payload[key] === "string" && payload[key].trim()) {
          return payload[key].trim();
        }
      }
      const data = payload.data;
      if (data && typeof data === "object") {
        for (const key of ["token", "jwt", "accessToken", "access_token"]) {
          if (typeof data[key] === "string" && data[key].trim()) {
            return data[key].trim();
          }
        }
      }
      return null;
    }

    function wireForgeHomeLink() {
      const home = document.getElementById("forgeHomeLink");
      if (home) home.setAttribute("href", forgeHomeHref());
    }

    function authHeaders() {
      return _forgeToken
        ? { "Content-Type": "application/json", "Authorization": "Bearer " + _forgeToken }
        : { "Content-Type": "application/json" };
    }

    function showAuthError(message) {
      integrationStatus.textContent = fpFormat("runtime.authUnavailablePrefix", {}) + message;
      if (authBanner) {
        authBanner.innerHTML =
          message +
          ' <a href="' + buildSkiaLoginUrl() + '" rel="noopener noreferrer">' +
          (fp("runtime.authLoginLink") || "Log in at skia.ca") +
          "</a>" +
          (fp("runtime.authLoginSuffix") || ". You will return here after sign-in.");
        authBanner.classList.add("visible");
      }
    }

    async function bootstrapForgeSession() {
      const urlToken = readTokenFromUrl();
      if (urlToken) {
        persistForgeToken(urlToken);
        scrubTokenFromUrl();
        try {
          sessionStorage.removeItem("forge_handoff_attempted");
        } catch {}
      } else {
        const stored = readStoredForgeToken();
        if (stored) _forgeToken = stored;
      }

      if (
        !urlToken &&
        !_forgeToken &&
        isArrivingFromSkiaSite() &&
        !sessionStorage.getItem("forge_handoff_attempted")
      ) {
        try {
          sessionStorage.setItem("forge_handoff_attempted", "1");
        } catch {}
        redirectToSkiaHandoff();
        return;
      }

      const sessionHeaders = {
        "Content-Type": "application/json",
        "x-skia-client": "forge-web"
      };
      if (_forgeToken) {
        sessionHeaders.Authorization = "Bearer " + _forgeToken;
      }

      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          headers: sessionHeaders
        });
        if (!res.ok) {
          if (!sessionStorage.getItem("forge_handoff_attempted")) {
            try {
              sessionStorage.setItem("forge_handoff_attempted", "1");
            } catch {}
            redirectToSkiaHandoff();
            return;
          }
          showAuthError(fp("runtime.sessionExpired") || "Session expired or not logged in. Please log in at skia.ca first.");
          return;
        }
        const data = await res.json();
        const token = extractTokenFromPayload(data) || data.token || data.accessToken || null;
        if (token) {
          persistForgeToken(token);
          try {
            sessionStorage.removeItem("forge_handoff_attempted");
          } catch {}
        } else if (data.user && _forgeToken) {
          try {
            sessionStorage.removeItem("forge_handoff_attempted");
          } catch {}
        } else if (!_forgeToken) {
          if (!sessionStorage.getItem("forge_handoff_attempted")) {
            try {
              sessionStorage.setItem("forge_handoff_attempted", "1");
            } catch {}
            redirectToSkiaHandoff();
            return;
          }
          showAuthError(fp("runtime.noToken") || "No token returned. Please log in at skia.ca first.");
          return;
        }
        if (authBanner) {
          authBanner.classList.remove("visible");
          authBanner.textContent = "";
        }
      } catch {
        showAuthError(fp("runtime.authServiceUnreachable") || "Could not reach auth service.");
      }
    }

    function buildModuleDescriptions() {
      const modules = ["agent", "context", "sdlc", "production", "healing", "architecture", "orchestrate"];
      const out = {};
      for (const key of modules) {
        out[key] = {
          title: fp("modules." + key + ".title") || key,
          desc: fp("modules." + key + ".desc") || ""
        };
      }
      return out;
    }

    function setActiveModule(next) {
      activeModule = next;
      moduleButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.module === next));
      const moduleDescriptions = buildModuleDescriptions();
      const info = moduleDescriptions[next] || {
        title: next,
        desc: fp("hero.fallbackDesc") || "Select a prompt and run this module."
      };
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
          integrationStatus.textContent = fp("header.statusNotAuthenticated") || "SKIA INTEGRATION UNAVAILABLE — not authenticated";
          return;
        }

        const integrationData = await integrationRes.json();
        integrationStatus.textContent = integrationData.enabled
          ? (fp("header.statusConnected") || "SKIA CONNECTED")
          : (fp("header.statusUnavailable") || "SKIA INTEGRATION UNAVAILABLE");
      } catch {
        integrationStatus.textContent = fp("header.statusUnavailable") || "SKIA INTEGRATION UNAVAILABLE";
      }
    }

    function requireAuthForAction() {
      if (_forgeToken) return true;
      mainOutput.textContent = fp("runtime.notAuthenticated") || "Not authenticated. Log in at skia.ca and reload this page.";
      return false;
    }

    async function runSelectedModule() {
      if (!requireAuthForAction()) return;
      const prompt = String(document.getElementById("prompt").value || "").trim();
      if (!prompt) {
        mainOutput.textContent = fp("runtime.addPromptFirst") || "Add a prompt first.";
        return;
      }
      mainOutput.textContent = fpFormat("runtime.runningModule", { module: activeModule });
      try {
        if (activeModule === "orchestrate") {
          const res = await fetch("/api/forge/orchestrate", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ intent: prompt, mode: "adaptive", approved: false })
          });
          if (res.status === 401) {
            mainOutput.textContent = fp("runtime.sessionExpiredAction") || "Session expired. Log in at skia.ca and reload this page.";
            return;
          }
          const data = await res.json();
          mainOutput.textContent = JSON.stringify(data, null, 2);
          metaOutput.textContent = fpFormat("runtime.orchestrationComplete", { status: res.status });
          return;
        }

        const res = await fetch("/api/forge/module/" + activeModule, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ query: prompt, task: prompt, mode: "adaptive", approved: false })
        });
        if (res.status === 401) {
          mainOutput.textContent = fp("runtime.sessionExpiredAction") || "Session expired. Log in at skia.ca and reload this page.";
          return;
        }
        const data = await res.json();
        mainOutput.textContent = JSON.stringify(data, null, 2);
        metaOutput.textContent = fpFormat("runtime.moduleComplete", { module: activeModule, status: res.status });
      } catch (error) {
        mainOutput.textContent = fp("runtime.requestFailed") || "Request failed.";
        metaOutput.textContent = String(error);
      }
    }

    async function runOrchestration() {
      if (!requireAuthForAction()) return;
      const prompt = String(document.getElementById("prompt").value || "").trim();
      if (!prompt) {
        mainOutput.textContent = fp("runtime.addPromptFirst") || "Add a prompt first.";
        return;
      }
      mainOutput.textContent = fp("runtime.runningLifecycle") || "Running lifecycle orchestration...";
      try {
        const res = await fetch("/api/forge/orchestrate", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ intent: prompt, mode: "adaptive", approved: false })
        });
        if (res.status === 401) {
          mainOutput.textContent = fp("runtime.sessionExpiredAction") || "Session expired. Log in at skia.ca and reload this page.";
          return;
        }
        const data = await res.json();
        mainOutput.textContent = JSON.stringify(data, null, 2);
        metaOutput.textContent = fpFormat("runtime.lifecycleComplete", { status: res.status });
      } catch (error) {
        mainOutput.textContent = fp("runtime.lifecycleFailed") || "Lifecycle run failed.";
        metaOutput.textContent = String(error);
      }
    }

    async function checkHealth() {
      if (!requireAuthForAction()) return;
      metaOutput.textContent = fp("runtime.checkingHealth") || "Checking health...";
      try {
        const res = await fetch("/api/forge/modules/status", { headers: authHeaders() });
        if (res.status === 401) {
          metaOutput.textContent = fp("runtime.notAuthenticatedShort") || "Not authenticated.";
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
      loadForgePlatformMessages();
      wireForgeHomeLink();
      setActiveModule(activeModule);
      await bootstrapForgeSession();
      if (!_forgeToken) return;
      await refreshIntegration();
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || _forgeToken) return;
      void bootstrapForgeSession().then(() => {
        if (_forgeToken) void refreshIntegration();
      });
    });

    function startWhenI18nReady() {
      if (window.__forgeI18n) {
        init();
      } else {
        document.addEventListener("forge-i18n-ready", init, { once: true });
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startWhenI18nReady);
    } else {
      startWhenI18nReady();
    }
  </script>
  ${forgeDownloadClientGateScript()}
</body>
</html>`;
}