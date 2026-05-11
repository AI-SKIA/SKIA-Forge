import type { Express, Request, Response } from "express";
import type { SkiaFullAdapter } from "./skiaFullAdapter.js";
import type { ForgeModuleName } from "./forgeModuleExecutor.js";
import type {
  DiffRequest,
  ProposeEditRequest,
  ProposeRefactorRequest,
  RepoAnalyzeRequest
} from "./types/codeIntelligence.js";

export type ForgeCodeIntelRouteDeps = {
  skiaFullAdapter: SkiaFullAdapter;
  enforceForgeModuleAccess: (
    req: Request,
    res: Response,
    moduleName: ForgeModuleName
  ) => Promise<{ mode: unknown; approved: boolean } | null>;
  pickSkiaHeaders: (req: Request) => Record<string, string>;
};

export function registerForgeCodeIntelRoutes(app: Express, deps: ForgeCodeIntelRouteDeps): void {
  const { skiaFullAdapter, enforceForgeModuleAccess, pickSkiaHeaders } = deps;

  app.post("/api/forge/code/analyze", async (req, res) => {
    try {
      const access = await enforceForgeModuleAccess(req, res, "agent");
      if (!access) return;
      const upstream = await skiaFullAdapter.analyzeRepo(
        req.body as RepoAnalyzeRequest,
        pickSkiaHeaders(req)
      );
      return res.json(upstream);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Forge code analyze failed";
      return res.status(502).json({ error: message });
    }
  });

  app.post("/api/forge/code/propose-edit", async (req, res) => {
    try {
      const access = await enforceForgeModuleAccess(req, res, "agent");
      if (!access) return;
      const upstream = await skiaFullAdapter.proposeEdit(
        req.body as ProposeEditRequest,
        pickSkiaHeaders(req)
      );
      return res.json(upstream);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Forge code propose-edit failed";
      return res.status(502).json({ error: message });
    }
  });

  app.post("/api/forge/code/propose-refactor", async (req, res) => {
    try {
      const access = await enforceForgeModuleAccess(req, res, "agent");
      if (!access) return;
      const upstream = await skiaFullAdapter.proposeRefactor(
        req.body as ProposeRefactorRequest,
        pickSkiaHeaders(req)
      );
      return res.json(upstream);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Forge code propose-refactor failed";
      return res.status(502).json({ error: message });
    }
  });

  app.post("/api/forge/code/diff", async (req, res) => {
    try {
      const access = await enforceForgeModuleAccess(req, res, "agent");
      if (!access) return;
      const upstream = await skiaFullAdapter.computeDiff(
        req.body as DiffRequest,
        pickSkiaHeaders(req)
      );
      return res.json(upstream);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Forge code diff failed";
      return res.status(502).json({ error: message });
    }
  });
}
