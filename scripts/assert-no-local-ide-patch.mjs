#!/usr/bin/env node
/**
 * Refuse IDE production builds when local-dev overrides were applied into skia-ide/.
 * Marker: .local-dev-ide-patch-applied at repo root (see local-dev/scripts/apply-forge-ide-local-patch.ps1).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const marker = path.join(repoRoot, ".local-dev-ide-patch-applied");

if (fs.existsSync(marker)) {
  console.error(
    "[assert-no-local-ide-patch] Local IDE overrides are applied (.local-dev-ide-patch-applied).\n" +
      "  Revert before packaging: . .\\local-dev\\scripts\\revert-forge-ide-local-patch.ps1"
  );
  process.exit(1);
}

if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
  if ((process.env.LOCAL_SKIA_BACKEND_URL ?? "").trim()) {
    console.error(
      "[assert-no-local-ide-patch] LOCAL_SKIA_BACKEND_URL must not be set in CI (production build context)."
    );
    process.exit(1);
  }
}
