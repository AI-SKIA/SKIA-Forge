import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { recordSdlcEvent } from "../sdlc/sdlcEventModel.js";

const pexec = promisify(exec);

export type ValidationCommandResult = {
  name: string;
  command: string;
  exitCode: number;
  failed: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type PackageValidationResult = {
  ok: boolean;
  results: ValidationCommandResult[];
  summary: string;
};

function tail(s: string, n: number): string {
  if (s.length <= n) {
    return s;
  }
  return s.slice(-n);
}

/**
 * D1-11: test → lint → typecheck; typecheck from scripts or `npx tsc --noEmit` if tsconfig exists.
 */
export async function buildValidationPlan(
  projectRoot: string,
  scripts: Record<string, string> | undefined
): Promise<{ name: string; command: string }[]> {
  const s = scripts ?? {};
  const cmd: { name: string; command: string }[] = [];
  if (typeof s["test"] === "string" && s["test"]!.trim()) {
    cmd.push({ name: "test", command: "npm run test" });
  }
  if (typeof s["lint"] === "string" && s["lint"]!.trim()) {
    cmd.push({ name: "lint", command: "npm run lint" });
  }
  let haveTs = false;
  if (typeof s["typecheck"] === "string" && s["typecheck"]!.trim()) {
    cmd.push({ name: "typecheck", command: "npm run typecheck" });
    haveTs = true;
  } else if (typeof s["tsc"] === "string" && s["tsc"]!.trim()) {
    cmd.push({ name: "typecheck", command: "npm run tsc" });
    haveTs = true;
  }
  if (!haveTs) {
    try {
      await fs.access(path.join(projectRoot, "tsconfig.json"));
      cmd.push({ name: "typecheck", command: "npx tsc --noEmit" });
    } catch {
      /* */
    }
  }
  return cmd;
}

export function validationFailureSummary(
  r: PackageValidationResult,
  maxTail: number
): { text: string; byCommand: Record<string, { exit: number; stderr: string; stdout: string }> } {
  const byCommand: Record<string, { exit: number; stderr: string; stdout: string }> = {};
  for (const x of r.results) {
    if (x.failed) {
      byCommand[x.name] = { exit: x.exitCode, stderr: tail(x.stderr, maxTail), stdout: tail(x.stdout, maxTail) };
    }
  }
  const t = r.results
    .filter((x) => x.failed)
    .map((x) => `${x.command} exit ${x.exitCode} stderr: ${tail(x.stderr, 4000)}`)
    .join("\n---\n");
  return { text: t, byCommand };
}

export async function readPackageJsonScripts(
  projectRoot: string
): Promise<Record<string, string> | null> {
  const p = path.join(projectRoot, "package.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const j = JSON.parse(raw) as { scripts?: Record<string, string> };
    return j.scripts ? { ...j.scripts } : null;
  } catch {
    return null;
  }
}

export async function runPackageValidation(
  projectRoot: string
): Promise<PackageValidationResult> {
  const scripts = await readPackageJsonScripts(projectRoot);
  const plan = await buildValidationPlan(projectRoot, scripts ?? undefined);
  const results: ValidationCommandResult[] = [];
  if (plan.length === 0) {
    return {
      ok: true,
      results: [],
      summary: "No test/lint/typecheck scripts in package.json; validation skipped."
    };
  }
  for (const spec of plan) {
    const t0 = Date.now();
    let exitCode: number;
    let stdout: string;
    let stderr: string;
    try {
      const o = await pexec(spec.command, {
        cwd: projectRoot,
        maxBuffer: 2 * 1024 * 1024,
        timeout: 10 * 60_000,
        env: { ...process.env, CI: "1" },
        windowsHide: true
      });
      stdout = String(o.stdout ?? "");
      stderr = String(o.stderr ?? "");
      exitCode = 0;
    } catch (e) {
      const ex = e as { stdout?: string; stderr?: string; code?: number; killed?: boolean; message?: string };
      if (ex.killed) {
        const durationMs = Date.now() - t0;
        results.push({
          name: spec.name,
          command: spec.command,
          exitCode: 124,
          failed: true,
          stdout: String(ex.stdout ?? ""),
          stderr: "Command timed out.",
          durationMs
        });
        return {
          ok: false,
          results,
          summary: `${spec.name} timeout`
        };
      }
      exitCode = typeof ex.code === "number" ? ex.code : 1;
      stdout = String(ex.stdout ?? "");
      stderr = String(ex.stderr ?? ex.message ?? e);
    }
    const durationMs = Date.now() - t0;
    const failed = exitCode !== 0;
    results.push({ name: spec.name, command: spec.command, exitCode, failed, stdout, stderr, durationMs });
    const mappedType =
      spec.name === "test"
        ? "test_run"
        : spec.name === "lint"
          ? "lint_run"
          : spec.name === "typecheck"
            ? "typecheck_run"
            : spec.name === "build"
              ? "build_run"
              : null;
    if (mappedType) {
      await recordSdlcEvent({
        projectRoot,
        type: mappedType,
        status: failed ? "failure" : "success",
        durationMs,
        details: failed ? `${spec.command} exit ${exitCode}` : undefined,
        meta: {
          command: spec.command,
          name: spec.name,
          exitCode
        }
      });
    }
    if (failed) {
      return {
        ok: false,
        results,
        summary: `${spec.name} failed (exit ${exitCode})`
      };
    }
  }
  return { ok: true, results, summary: "all checks passed" };
}
