import { Router, Request, Response } from "express";
import {
  isLocalBackendMode,
  resolveLocalEngineConfig,
  resolveSkiaBackendUrl,
} from "../config/localBackend.js";

const router = Router();
const PROBE_MS = 4000;

async function probeUrl(url: string, method: "GET" | "HEAD" = "GET"): Promise<boolean> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PROBE_MS);
  try {
    const res = await fetch(url, { method, signal: ac.signal, headers: { Accept: "*/*" } });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function proxySkiaLocal(pathSuffix: string): Promise<globalThis.Response | null> {
  const base = resolveSkiaBackendUrl().replace(/\/+$/, "");
  try {
    return await fetch(`${base}${pathSuffix}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return null;
  }
}

router.get("/health", async (_req: Request, res: Response) => {
  if (!isLocalBackendMode()) {
    res.json({
      status: "production",
      message: "Local backend mode is off. Set LOCAL_SKIA_BACKEND_URL to enable local health probes.",
      localMode: false,
    });
    return;
  }

  const upstream = await proxySkiaLocal("/api/local/health");
  if (upstream?.ok) {
    const body = await upstream.json();
    res.status(upstream.status).json({ ...body, forgeLocalMode: true });
    return;
  }

  const cfg = resolveLocalEngineConfig();
  const [backendOk, serveOk] = await Promise.all([
    probeUrl(`${cfg.skiaBackendUrl.replace(/\/+$/, "")}/api/health`),
    probeUrl(`${cfg.skiaServeUrl.replace(/\/+$/, "")}/api/health`),
  ]);

  res.status(backendOk ? 200 : 503).json({
    status: backendOk ? "partial" : "degraded",
    forgeLocalMode: true,
    skiaBackendUrl: cfg.skiaBackendUrl,
    checks: {
      backend: backendOk ? "healthy" : "degraded",
      skiaServe: serveOk ? "healthy" : "degraded",
    },
    note: upstream ? `Upstream /api/local/health returned ${upstream.status}` : "Could not reach SKIA /api/local/health",
  });
});

router.get("/services", async (_req: Request, res: Response) => {
  if (!isLocalBackendMode()) {
    res.json({ localMode: false, services: [] });
    return;
  }
  const upstream = await proxySkiaLocal("/api/local/services");
  if (upstream?.ok) {
    res.status(upstream.status).json(await upstream.json());
    return;
  }
  const cfg = resolveLocalEngineConfig();
  const jobs = [
    { name: "skia-backend", url: `${cfg.skiaBackendUrl}/api/health` },
    { name: "skia-serve", url: `${cfg.skiaServeUrl}/api/health` },
    { name: "embedding-engine", url: `${cfg.embeddingEngineUrl}/health` },
    { name: "vector-db", url: `${cfg.vectorDbUrl}/health` },
    { name: "skia-video-service", url: `${cfg.videoServiceUrl}/health` },
  ];
  if (cfg.comfyuiUrl) jobs.push({ name: "comfyui", url: `${cfg.comfyuiUrl}/system_stats` });
  if (cfg.sdWebuiUrl) jobs.push({ name: "sd-webui", url: `${cfg.sdWebuiUrl}/sdapi/v1/sd-models` });

  const services = await Promise.all(
    jobs.map(async (j) => ({
      name: j.name,
      url: j.url,
      status: (await probeUrl(j.url)) ? "healthy" : "degraded",
    }))
  );
  res.json({ localMode: true, services, timestamp: new Date().toISOString() });
});

router.get("/engines", async (_req: Request, res: Response) => {
  if (!isLocalBackendMode()) {
    res.json({ localMode: false });
    return;
  }
  const upstream = await proxySkiaLocal("/api/local/engines");
  if (upstream?.ok) {
    res.status(upstream.status).json(await upstream.json());
    return;
  }
  res.json({
    localMode: true,
    forgeConfig: resolveLocalEngineConfig(),
    note: "SKIA /api/local/engines unreachable — showing Forge-resolved config only.",
  });
});

export default router;
