export function renderForgePlatformHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SKIA Forge | Web IDE</title>
  <style>
    :root {
      --bg: #080400;
      --panel: linear-gradient(135deg, rgba(15, 8, 0, 0.95) 0%, rgba(25, 14, 0, 0.95) 100%);
      --line: rgba(212, 175, 55, 0.22);
      --text: #f1e2ad;
      --muted: rgba(255, 255, 255, 0.62);
      --gold: #d4af37;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255, 180, 0, 0.06) 0%, transparent 70%), var(--bg);
      color: var(--text);
      font-family: Orbitron, Arial, sans-serif;
      height: 100dvh;
      overflow: hidden;
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
    .brand { color: var(--gold); letter-spacing: 1px; font-size: 20px; }
    .status { color: var(--muted); font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
    .download-btn {
      text-decoration: none;
      color: var(--gold);
      border: 1px solid rgba(212, 175, 55, 0.4);
      background: rgba(212, 175, 55, 0.08);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .download-btn:hover {
      background: rgba(212, 175, 55, 0.16);
      border-color: rgba(212, 175, 55, 0.7);
    }

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
    .section-title { color: var(--gold); padding: 12px; border-bottom: 1px solid var(--line); font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; }
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
      font-family: Orbitron, Arial, sans-serif;
      font-size: 12px;
      letter-spacing: 1px;
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
      letter-spacing: 1.4px;
      text-transform: uppercase;
    }
    .hero p {
      margin: 0;
      color: var(--muted);
      font-family: Nunito, Arial, sans-serif;
      font-size: 14px;
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
      letter-spacing: 1.5px;
      text-transform: uppercase;
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
      font-family: Nunito, Arial, sans-serif;
      font-size: 14px;
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
      letter-spacing: 1.4px;
      text-transform: uppercase;
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
      font-family: Nunito, Arial, sans-serif;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.86);
      line-height: 1.55;
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
    <div class="brand">SKIA FORGE IDE</div>
    <div class="status" id="integrationStatus">Integration: checking...</div>
    <a class="download-btn" href="https://github.com/AI-SKIA/skia/releases/latest" target="_blank" rel="noreferrer">Download App</a>
  </div>
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
        <h1>Forge Web IDE</h1>
        <p>Choose a module, write your prompt, and run it. Output appears below.</p>
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
    const mainOutput = document.getElementById("mainOutput");
    const metaOutput = document.getElementById("metaOutput");
    const moduleButtons = Array.from(document.querySelectorAll(".mod-btn"));
    let activeModule = "agent";

    function setActiveModule(next) {
      activeModule = next;
      moduleButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.module === next));
    }

    moduleButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveModule(btn.dataset.module || "agent");
      });
    });

    async function refreshIntegration() {
      try {
        const [integrationData, modeData] = await Promise.all([
          fetch("/integration/skia-full").then((r) => r.json()),
          fetch("/api/forge/mode").then((r) => r.json())
        ]);
        integrationStatus.textContent =
          "Integration: " + (integrationData.enabled ? "enabled" : "disabled") +
          " | brainOnly=" + String(integrationData.brainOnly) +
          " | mode=" + String(modeData.mode || "adaptive");
      } catch {
        integrationStatus.textContent = "Integration: unavailable";
      }
    }

    async function runSelectedModule() {
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
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ intent: prompt, mode: "adaptive", approved: false })
          });
          const data = await res.json();
          mainOutput.textContent = JSON.stringify(data, null, 2);
          metaOutput.textContent = "Orchestration complete (" + res.status + ").";
          return;
        }

        const res = await fetch("/api/forge/module/" + activeModule, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: prompt, task: prompt, mode: "adaptive", approved: false })
        });
        const data = await res.json();
        mainOutput.textContent = JSON.stringify(data, null, 2);
        metaOutput.textContent = "Module " + activeModule + " complete (" + res.status + ").";
      } catch (error) {
        mainOutput.textContent = "Request failed.";
        metaOutput.textContent = String(error);
      }
    }

    async function runOrchestration() {
      const prompt = String(document.getElementById("prompt").value || "").trim();
      if (!prompt) {
        mainOutput.textContent = "Add a prompt first.";
        return;
      }
      mainOutput.textContent = "Running lifecycle orchestration...";
      try {
        const res = await fetch("/api/forge/orchestrate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intent: prompt, mode: "adaptive", approved: false })
        });
        const data = await res.json();
        mainOutput.textContent = JSON.stringify(data, null, 2);
        metaOutput.textContent = "Lifecycle complete (" + res.status + ").";
      } catch (error) {
        mainOutput.textContent = "Lifecycle run failed.";
        metaOutput.textContent = String(error);
      }
    }

    async function checkHealth() {
      metaOutput.textContent = "Checking health...";
      try {
        const data = await fetch("/api/forge/modules/status").then((r) => r.json());
        metaOutput.textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        metaOutput.textContent = String(error);
      }
    }

    document.getElementById("runModule").addEventListener("click", runSelectedModule);
    document.getElementById("runOrchestration").addEventListener("click", runOrchestration);
    document.getElementById("checkHealth").addEventListener("click", checkHealth);

    refreshIntegration();
  </script>
</body>
</html>`;
}
