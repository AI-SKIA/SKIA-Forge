/**
 * D1-01: Local baseline for full-file structural extraction (synthetic large TS file).
 * Not a CI gate — run manually: npm run bench:structure
 * Plan reference: ~100K LOC in < 30s (this script extrapolates from a 20K-line sample).
 */
import { performance } from "node:perf_hooks";
import { extractStructuralSymbols } from "../src/forge/modules/context-engine/extractStructuralSymbols.js";

const LINE_COUNT = 20_000;
const filePath = "bench/synth-large.ts";
const parts: string[] = ["// synthetic", 'import "node:fs";', ""];
for (let i = 0; i < LINE_COUNT; i++) {
  parts.push(`export function fn_${i}(): number { return ${i}; }`);
}
const source = parts.join("\n");

const t0 = performance.now();
const { engine, symbols } = extractStructuralSymbols(filePath, source);
const wallMs = performance.now() - t0;

const lineTotal = source.split("\n").length;
const est100Kms = (wallMs / lineTotal) * 100_000;
const within30s = est100Kms < 30_000;

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      filePath,
      lineTotal,
      engine,
      symbolCount: symbols.length,
      wallMs: Math.round(wallMs * 100) / 100,
      extrapolated100KLocMs: Math.round(est100Kms * 100) / 100,
      plan30s100K: "< 30000 ms",
      extrapolationWithin30s: within30s
    },
    null,
    2
  )
);
