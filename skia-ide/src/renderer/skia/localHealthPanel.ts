/**
 * IDE Local Health Panel (renderer) — mirrors src/routes/localHealth.tsx probes.
 */

export type LocalHealthServiceRow = {
  name: string;
  url: string;
  status: string;
};

export type LocalHealthPanelOptions = {
  backendUrl: string;
  skiaServeUrl: string;
  embeddingEngineUrl: string;
  vectorDbUrl: string;
  videoServiceUrl: string;
  comfyuiUrl?: string | null;
  sdWebuiUrl?: string | null;
  localMode: boolean;
  founderOverride?: boolean;
  founderEmail?: string;
};

const PROBE_MS = 4000;

async function probe(url: string): Promise<"healthy" | "degraded" | "unconfigured"> {
  if (!url) return "unconfigured";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PROBE_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: "*/*" } });
    return res.ok ? "healthy" : "degraded";
  } catch {
    return "degraded";
  } finally {
    clearTimeout(timer);
  }
}

function statusClass(status: string): string {
  if (status === "healthy") return "lh-ok";
  if (status === "unconfigured") return "lh-muted";
  return "lh-bad";
}

function rowHtml(name: string, url: string, status: string): string {
  return `<tr>
    <td class="lh-name">${name}</td>
    <td class="lh-url">${url || "—"}</td>
    <td class="lh-status ${statusClass(status)}">${status}</td>
  </tr>`;
}

async function fetchLocalHealthRows(options: LocalHealthPanelOptions): Promise<LocalHealthServiceRow[]> {
  const base = options.backendUrl.replace(/\/+$/, "");

  if (options.localMode) {
    try {
      const res = await fetch(`${base}/api/local/services`);
      if (res.ok) {
        const data = (await res.json()) as { services?: LocalHealthServiceRow[] };
        if (Array.isArray(data.services) && data.services.length) {
          return data.services;
        }
      }
    } catch {
      /* direct probes */
    }
  }

  const jobs: { name: string; url: string; probeUrl: string }[] = [
    { name: "Local backend", url: base, probeUrl: `${base}/api/health` },
    { name: "skia-serve", url: options.skiaServeUrl, probeUrl: `${options.skiaServeUrl.replace(/\/+$/, "")}/api/health` },
    { name: "embedding-engine", url: options.embeddingEngineUrl, probeUrl: `${options.embeddingEngineUrl.replace(/\/+$/, "")}/health` },
    { name: "vector-db", url: options.vectorDbUrl, probeUrl: `${options.vectorDbUrl.replace(/\/+$/, "")}/health` },
    { name: "skia-video-service", url: options.videoServiceUrl, probeUrl: `${options.videoServiceUrl.replace(/\/+$/, "")}/health` },
  ];
  if (options.comfyuiUrl) {
    jobs.push({ name: "ComfyUI", url: options.comfyuiUrl, probeUrl: `${options.comfyuiUrl.replace(/\/+$/, "")}/system_stats` });
  }
  if (options.sdWebuiUrl) {
    jobs.push({ name: "SD WebUI", url: options.sdWebuiUrl, probeUrl: `${options.sdWebuiUrl.replace(/\/+$/, "")}/sdapi/v1/sd-models` });
  }

  const rows: LocalHealthServiceRow[] = [];
  for (const job of jobs) {
    rows.push({ name: job.name, url: job.url, status: job.url ? await probe(job.probeUrl) : "unconfigured" });
  }
  return rows;
}

let teardown: (() => void) | null = null;

export async function initializeLocalHealthPanel(options: LocalHealthPanelOptions): Promise<void> {
  const container = document.getElementById("local-health-root");
  if (!container) return;

  if (teardown) {
    teardown();
    teardown = null;
  }

  const modeLabel = options.localMode
    ? "Local backend mode active"
    : "Production backend (set LOCAL_SKIA_BACKEND_URL for local)";

  const founderHint =
    options.founderOverride && options.founderEmail
      ? `<p class="lh-mode">Founder Override: sign in as <strong>${options.founderEmail}</strong> (Skia-FULL LOCAL_FOUNDER_PASSWORD)</p>`
      : "";

  container.innerHTML = `
    <div class="local-health-panel">
      <div class="lh-header">
        <span class="lh-title">LOCAL STACK HEALTH</span>
        <button type="button" id="lh-refresh" class="lh-refresh">REFRESH</button>
      </div>
      <p class="lh-mode">${modeLabel}</p>
      ${founderHint}
      <div id="lh-table-wrap"><p class="lh-loading">Probing services…</p></div>
    </div>`;

  const tableWrap = container.querySelector("#lh-table-wrap") as HTMLElement;
  const refreshBtn = container.querySelector("#lh-refresh") as HTMLButtonElement;

  const render = async (): Promise<void> => {
    tableWrap.innerHTML = `<p class="lh-loading">Probing services…</p>`;
    const rows = await fetchLocalHealthRows(options);
    tableWrap.innerHTML = `
      <table class="lh-table">
        <thead><tr><th>Service</th><th>URL</th><th>Status</th></tr></thead>
        <tbody>${rows.map((r) => rowHtml(r.name, r.url, r.status)).join("")}</tbody>
      </table>`;
  };

  refreshBtn.addEventListener("click", () => {
    void render();
  });

  await render();
  const interval = window.setInterval(() => void render(), 30000);
  teardown = () => window.clearInterval(interval);
}
