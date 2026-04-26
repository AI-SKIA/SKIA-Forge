# Architecture Baseline Refresh Runbook

## Purpose

This runbook defines how to refresh and validate `.skia/architecture-baseline-v1.json` in `C:\SKIA-Forge`.

The baseline is used as an architectural reference snapshot for diagnostics, hotspot tracking, and governance trend comparisons.

## When to refresh

Refresh the baseline when any of the following occur:

- major module additions/removals in `src/forge/modules/`,
- substantial orchestration/governance refactors,
- release boundary where architecture trend comparison must reset,
- diagnostics output indicates drift against stale baseline assumptions.

Recommended minimum cadence: once per release cycle.

## Prerequisites

- Working tree is clean or changes are intentional.
- `npm install` completed for Forge workspace.
- TypeScript compile path is healthy (`npx tsc --noEmit`).

## Refresh procedure

1. **Collect live repository shape**
   - count module directories under `src/forge/modules/`,
   - list route files (`*Routes.ts`),
   - compute active TypeScript file inventory.

2. **Regenerate baseline content**
   - update metadata: `generatedAt`, `populatedAt`, `populatedBy`,
   - refresh module and file counts,
   - refresh hotspot/node/edge data from current diagnostics pipeline or accepted baseline generator.

3. **Write baseline file**
   - target: `.skia/architecture-baseline-v1.json`
   - encoding: UTF-8
   - format: valid JSON object

## Acceptance checks

After refresh, verify:

- baseline file parses as valid JSON,
- no required graph sections are empty without explicit justification,
- metadata fields are current:
  - `generatedAt`
  - `populatedAt`
  - `populatedBy`
- core counts are non-zero and aligned with live repo state:
  - module count
  - TypeScript file count
  - route file inventory

## Validation commands

Run from `C:\SKIA-Forge`:

```bash
npx tsc --noEmit
npm run typecheck
```

Both must complete with 0 errors.

## Post-refresh verification

- Confirm diagnostics paths can still consume the baseline.
- Confirm no downstream runbook or status document still references old baseline assumptions.
- Record refresh in changelog/release notes with date and operator identity.

## Failure handling

If baseline generation introduces invalid or inconsistent data:

1. revert to last known-good baseline file,
2. rerun generation with corrected source inputs,
3. repeat acceptance checks before re-publishing.
