export function renderForgePlatformHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SKIA Forge Platform</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --panel: #111111;
      --line: #232323;
      --text: #e8e8e8;
      --muted: #9a9a9a;
      --gold: #d4af37;
    }
    * { box-sizing: border-box; font-family: Calibri, Arial, sans-serif; font-weight: 400; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    .topbar {
      height: 44px; border-bottom: 1px solid var(--line); display: flex; align-items: center;
      justify-content: space-between; padding: 0 12px; background: #0d0d0d;
    }
    .brand { color: var(--gold); letter-spacing: 0.4px; }
    .status { color: var(--muted); font-size: 13px; }
    .root {
      height: calc(100vh - 44px);
      display: grid;
      grid-template-columns: 280px 1fr 420px;
    }
    .left, .center, .right { border-right: 1px solid var(--line); }
    .right { border-right: none; }
    .left, .right { background: var(--panel); overflow: auto; }
    .section-title { color: var(--gold); padding: 12px; border-bottom: 1px solid var(--line); }
    .tree { padding: 10px 12px; color: var(--muted); font-size: 13px; line-height: 1.65; }
    .tree .active { color: var(--text); }
    .center {
      display: grid; place-items: center; background: #0a0a0a;
    }
    .logo-box {
      width: 120px; height: 120px; border: 1px solid var(--line); transform: rotate(45deg);
      display: grid; place-items: center; color: var(--gold); opacity: 0.9;
    }
    .logo-box span { transform: rotate(-45deg); letter-spacing: 1px; }
    .panel { padding: 12px; border-bottom: 1px solid var(--line); }
    .health-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
    .health-row { border: 1px solid #2b2b2b; border-radius: 6px; padding: 8px; font-size: 12px; }
    .health-row .name { color: var(--text); }
    .health-row .state { color: var(--muted); }
    .input, .textarea {
      width: 100%; background: #0f0f0f; border: 1px solid #2a2a2a; border-radius: 6px;
      color: var(--text); padding: 10px;
    }
    .textarea { min-height: 110px; resize: vertical; }
    .btn {
      margin-top: 8px; padding: 9px 12px; border-radius: 6px; border: 1px solid #6a5a1f;
      background: #18150a; color: var(--gold); cursor: pointer;
    }
    .result {
      margin-top: 10px; padding: 10px; border: 1px solid #2a2a2a; border-radius: 6px;
      background: #0f0f0f; color: #cbcbcb; font-size: 13px; white-space: pre-wrap;
    }
    .module-controls { margin-top: 10px; display: grid; gap: 6px; }
    .module-row {
      display: grid; grid-template-columns: 1fr auto auto; align-items: center;
      border: 1px solid #2b2b2b; border-radius: 6px; padding: 8px;
    }
    .module-name { color: var(--text); font-size: 13px; }
    .module-badge {
      font-size: 11px; color: var(--muted); border: 1px solid #3a3a3a; border-radius: 14px; padding: 2px 8px;
      margin-right: 6px;
    }
    .module-run { padding: 5px 9px; font-size: 12px; }
    .pill { display: inline-block; border: 1px solid #3a3a3a; color: var(--muted); padding: 2px 8px; border-radius: 20px; font-size: 12px; }
    .mode-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
    .checkline { margin-top: 8px; color: var(--muted); font-size: 12px; display: flex; gap: 6px; align-items: center; }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">SKIA FORGE</div>
    <div class="status" id="integrationStatus">Integration: checking...</div>
  </div>
  <div class="root">
    <aside class="left">
      <div class="section-title">Platform Modules</div>
      <div class="tree">
        <div class="active">forge/context</div>
        <div class="active">forge/agent</div>
        <div class="active">forge/sdlc</div>
        <div class="active">forge/production</div>
        <div class="active">forge/healing</div>
        <div class="active">forge/architecture</div>
        <div class="active">forge/orchestrate</div>
        <div style="margin-top: 8px;">api/forge/context/structure?path=</div>
        <div style="margin-top: 8px;">api/forge/context/semantic-chunks?path=</div>
        <div style="margin-top: 8px;">api/forge/context/embed/stats</div>
        <div style="margin-top: 8px;">api/forge/context/embed/index (POST JSON: path | paths, async?); auto re-embed on save: EMBED_INCREMENTAL_ON_SAVE=true</div>
        <div style="margin-top: 8px;">api/forge/context/embed/queue (GET depth + limits)</div>
        <div style="margin-top: 8px;">api/forge/context/embed/jobs/:jobId (GET status)</div>
        <div style="margin-top: 8px;">api/forge/context/embed/search (POST: query, topK?, nprobes?, where?, …; 200: hybrid score = vector×structural×recency, candidateK + vectorScore/structural/recency per hit)</div>
        <div style="margin-top: 8px;">api/forge/context/retrieve (POST: path, query?, maxTokens? ~8K; L1 file → L2 imports/deps → L3 hybrid search → L4 structure)</div>
        <div style="margin-top: 8px;">api/forge/agent/plan (POST: goal, path, contextQuery?; D1-07 + SKIA chat → JSON plan v1)</div>
        <div style="margin-top: 4px;">api/forge/agent/execute (POST: plan, steps, mode preview|apply, selfCorrect?; D1-10/11 tool registry, diff + approval, optional self-correct, audit)</div>
        <div style="margin-top: 8px;">integration/skia-full/probe/report</div>
      </div>
    </aside>
    <main class="center">
      <div class="logo-box"><span>SKIA</span></div>
    </main>
    <aside class="right">
      <div class="section-title">Module Health</div>
      <div class="panel">
        <button class="btn" id="refreshHealth">Refresh Health</button>
        <div class="result" id="healthResult">No health data loaded.</div>
      </div>
      <div class="section-title">Governance Telemetry</div>
      <div class="panel">
        <button class="btn" id="refreshGovernanceTelemetry">Refresh Governance</button>
        <div class="result" id="governanceTelemetryResult">No governance telemetry loaded.</div>
      </div>
      <div class="section-title">Approval Token Stats</div>
      <div class="panel">
        <button class="btn" id="refreshApprovalTokenStats">Refresh Tokens</button>
        <div class="result" id="approvalTokenStatsResult">No approval token stats loaded.</div>
      </div>
      <div class="section-title">Intent Signature Status</div>
      <div class="panel">
        <button class="btn" id="refreshIntentStatus">Refresh Intents</button>
        <input class="input" id="intentTs" placeholder="x-skia-intent-ts (ms epoch)" />
        <input class="input" id="intentNonce" placeholder="x-skia-intent-nonce" />
        <input class="input" id="intentSignature" placeholder="x-skia-intent-signature (hmac hex)" />
        <div class="result" id="intentStatusResult">No intent signature status loaded.</div>
      </div>
      <div class="section-title">Sovereign Posture</div>
      <div class="panel">
        <button class="btn" id="refreshSovereignPosture">Refresh Posture</button>
        <div class="result" id="sovereignPostureResult">No sovereign posture loaded.</div>
      </div>
      <div class="section-title">Control Plane</div>
      <div class="panel">
        <button class="btn" id="refreshControlPlane">Refresh Snapshot</button>
        <button class="btn" id="applyAlignMode">Apply Align-Mode</button>
        <button class="btn" id="applyRecommended">Apply Recommended</button>
        <div class="result" id="controlPlaneAlerts">No control plane alerts.</div>
        <div class="result" id="controlPlaneRecommendations">No recommendations yet.</div>
        <div class="result" id="controlPlaneResult">No control plane snapshot loaded.</div>
      </div>
      <div class="section-title">Orchestrate Intent</div>
      <div class="panel">
        <div class="mode-row">
          <select class="input" id="sovereignMode">
            <option value="strict">strict</option>
            <option value="adaptive" selected>adaptive</option>
            <option value="autonomous">autonomous</option>
          </select>
          <button class="btn" id="saveMode">Set Mode</button>
        </div>
        <div class="mode-row">
          <input class="input" id="approvalToken" placeholder="approval token (optional)" />
          <select class="input" id="approvalPurpose">
            <option value="any" selected>any</option>
            <option value="module">module</option>
            <option value="orchestration">orchestration</option>
            <option value="remediation">remediation</option>
          </select>
          <button class="btn" id="issueApprovalToken">Issue Token</button>
        </div>
        <label class="checkline"><input type="checkbox" id="approvalToggle" /> explicit approval</label>
        <textarea class="textarea" id="intent" placeholder="Describe the software objective..."></textarea>
        <button class="btn" id="runOrchestration">Run Lifecycle</button>
        <div class="module-controls" id="moduleControls"></div>
        <div class="result" id="orchestrationResult">No orchestration executed.</div>
      </div>
      <div class="section-title">Probe Report</div>
      <div class="panel">
        <button class="btn" id="runProbe">Check Brain Contracts</button>
        <button class="btn" id="runGovernancePreview">Preview Governance</button>
        <div class="result" id="probeResult">No probe executed.</div>
      </div>
    </aside>
  </div>
  <script>
    const integrationStatus = document.getElementById("integrationStatus");
    const orchestrationResult = document.getElementById("orchestrationResult");
    const healthResult = document.getElementById("healthResult");
    const governanceTelemetryResult = document.getElementById("governanceTelemetryResult");
    const approvalTokenStatsResult = document.getElementById("approvalTokenStatsResult");
    const intentStatusResult = document.getElementById("intentStatusResult");
    const sovereignPostureResult = document.getElementById("sovereignPostureResult");
    const controlPlaneAlerts = document.getElementById("controlPlaneAlerts");
    const controlPlaneRecommendations = document.getElementById("controlPlaneRecommendations");
    const controlPlaneResult = document.getElementById("controlPlaneResult");
    const probeResult = document.getElementById("probeResult");
    const moduleNames = ["context","agent","sdlc","production","healing","architecture"];
    const moduleControls = document.getElementById("moduleControls");
    function renderModuleControls() {
      moduleControls.innerHTML = moduleNames.map((name) => (
        '<div class="module-row">' +
          '<div class="module-name">' + name + '</div>' +
          '<div class="module-badge" id="badge-' + name + '">idle</div>' +
          '<button class="btn module-run" data-module="' + name + '">Run</button>' +
        '</div>'
      )).join("");
      moduleControls.querySelectorAll("button[data-module]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const module = btn.getAttribute("data-module");
          const intent = document.getElementById("intent").value;
          const mode = document.getElementById("sovereignMode").value;
          const approved = document.getElementById("approvalToggle").checked;
          const approvalToken = document.getElementById("approvalToken").value.trim();
          const badge = document.getElementById("badge-" + module);
          badge.textContent = "running";
          const res = await fetch("/api/forge/module/" + module, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query: intent, task: intent, mode, approved, approvalToken })
          });
          const data = await res.json();
          badge.textContent = res.ok ? "ok" : "failed";
          orchestrationResult.textContent = JSON.stringify(data, null, 2);
        });
      });
    }
    async function refreshIntegration() {
      try {
        const [integrationData, modeData, lockdownData] = await Promise.all([
          fetch("/integration/skia-full").then(r => r.json()),
          fetch("/api/forge/mode").then(r => r.json()),
          fetch("/api/forge/lockdown").then(r => r.json())
        ]);
        document.getElementById("sovereignMode").value = modeData.mode || "adaptive";
        integrationStatus.textContent =
          "Integration: " + (integrationData.enabled ? "enabled" : "disabled") +
          " | brainOnly=" + String(integrationData.brainOnly) +
          " | mode=" + String(modeData.mode || "adaptive") +
          " | lockdown=" + String(lockdownData.enabled === true ? "on" : "off");
      } catch {
        integrationStatus.textContent = "Integration: unavailable";
      }
    }
    function signedIntentHeaders() {
      const ts = document.getElementById("intentTs").value.trim();
      const nonce = document.getElementById("intentNonce").value.trim();
      const sig = document.getElementById("intentSignature").value.trim();
      const headers = { "content-type": "application/json" };
      if (ts) headers["x-skia-intent-ts"] = ts;
      if (nonce) headers["x-skia-intent-nonce"] = nonce;
      if (sig) headers["x-skia-intent-signature"] = sig;
      return headers;
    }
    document.getElementById("runOrchestration").addEventListener("click", async () => {
      const intent = document.getElementById("intent").value;
      const mode = document.getElementById("sovereignMode").value;
      const approved = document.getElementById("approvalToggle").checked;
      const approvalToken = document.getElementById("approvalToken").value.trim();
      const res = await fetch("/api/forge/orchestrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent, mode, approved, approvalToken })
      });
      const data = await res.json();
      orchestrationResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("saveMode").addEventListener("click", async () => {
      const mode = document.getElementById("sovereignMode").value;
      const res = await fetch("/api/forge/mode", {
        method: "POST",
        headers: signedIntentHeaders(),
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      integrationStatus.textContent = "Integration: enabled | brainOnly=true | mode=" + String(data.mode || mode);
    });
    document.getElementById("applyRecommended").insertAdjacentHTML("afterend", '<button class="btn" id="toggleLockdown">Toggle Lockdown</button>');
    document.getElementById("toggleLockdown").addEventListener("click", async () => {
      const approvalToken = document.getElementById("approvalToken").value.trim();
      const approved = document.getElementById("approvalToggle").checked;
      const current = await fetch("/api/forge/lockdown").then(r => r.json());
      const data = await fetch("/api/forge/lockdown", {
        method: "POST",
        headers: signedIntentHeaders(),
        body: JSON.stringify({ enabled: !current.enabled, approved, approvalToken })
      }).then(r => r.json());
      controlPlaneResult.textContent = JSON.stringify(data, null, 2);
      await refreshIntegration();
    });
    document.getElementById("issueApprovalToken").addEventListener("click", async () => {
      const purpose = document.getElementById("approvalPurpose").value;
      const data = await fetch("/api/forge/approval-token", {
        method: "POST",
        headers: signedIntentHeaders(),
        body: JSON.stringify({ purpose })
      }).then(r => r.json());
      if (typeof data.token === "string") {
        document.getElementById("approvalToken").value = data.token;
      }
      controlPlaneResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("runProbe").addEventListener("click", async () => {
      const data = await fetch("/integration/skia-full/probe/report").then(r => r.json());
      probeResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("runGovernancePreview").addEventListener("click", async () => {
      const mode = document.getElementById("sovereignMode").value;
      const approved = document.getElementById("approvalToggle").checked;
      const data = await fetch("/api/forge/orchestrate/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, approved, includeHealing: true })
      }).then(r => r.json());
      probeResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("refreshHealth").addEventListener("click", async () => {
      const data = await fetch("/api/forge/modules/status").then(r => r.json());
      healthResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("refreshGovernanceTelemetry").addEventListener("click", async () => {
      const data = await fetch("/api/forge/governance/telemetry").then(r => r.json());
      governanceTelemetryResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("refreshApprovalTokenStats").addEventListener("click", async () => {
      const data = await fetch("/api/forge/approval-token/stats").then(r => r.json());
      approvalTokenStatsResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("refreshIntentStatus").addEventListener("click", async () => {
      const data = await fetch("/api/forge/governance/intents/status").then(r => r.json());
      intentStatusResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("refreshSovereignPosture").addEventListener("click", async () => {
      const data = await fetch("/api/forge/sovereign-posture").then(r => r.json());
      sovereignPostureResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("refreshControlPlane").addEventListener("click", async () => {
      const data = await fetch("/api/forge/control-plane").then(r => r.json());
      controlPlaneAlerts.textContent = JSON.stringify(data.alerts || [], null, 2);
      controlPlaneRecommendations.textContent = JSON.stringify(data.recommendations || [], null, 2);
      controlPlaneResult.textContent = JSON.stringify(data, null, 2);
    });
    document.getElementById("applyAlignMode").addEventListener("click", async () => {
      const approved = document.getElementById("approvalToggle").checked;
      const approvalToken = document.getElementById("approvalToken").value.trim();
      const data = await fetch("/api/forge/control-plane/remediate", {
        method: "POST",
        headers: signedIntentHeaders(),
        body: JSON.stringify({ action: "align_mode", approved, approvalToken })
      }).then(r => r.json());
      controlPlaneResult.textContent = JSON.stringify(data, null, 2);
      await refreshIntegration();
    });
    document.getElementById("applyRecommended").addEventListener("click", async () => {
      const approved = document.getElementById("approvalToggle").checked;
      const approvalToken = document.getElementById("approvalToken").value.trim();
      const data = await fetch("/api/forge/control-plane/remediate/recommended", {
        method: "POST",
        headers: signedIntentHeaders(),
        body: JSON.stringify({ approved, approvalToken })
      }).then(r => r.json());
      controlPlaneResult.textContent = JSON.stringify(data, null, 2);
      await refreshIntegration();
    });
    renderModuleControls();
    refreshIntegration();
  </script>
</body>
</html>`;
}
