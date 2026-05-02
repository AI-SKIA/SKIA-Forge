# SKIA-Forge Troubleshooting

## Scope boundary

Use this guide for Forge **service** and **integration** issues. Product-runtime feature failures may belong to `Skia-FULL`; public status publication issues belong to `Skia-Status`.

## Build/Test Failures

- Run:
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
- Fix schema/type mismatches before re-running orchestration endpoints.

## SKIA-full Integration Unavailable

- Check `GET /integration/skia-full` and `GET /integration/skia-full/probe`.
- Verify `SKIA_FULL_API_URL`, `SKIA_FULL_ENABLED`, `SKIA_FULL_AUTH_BEARER` / `SKIA_FULL_API_KEY` as appropriate.
- Review adapter disabled flags in the integration response.

**Note:** The SKIA API host may expose `/api/health`; Forge itself uses **`/health`**, **`/live`**, **`/ready`** locally — do not assume a Forge route named `/api/health/*`.

## Governance Blocks

- Expected in strict or adaptive mode for risky actions.
- Read remediation recommendations.
- Re-run after remediation.

## Runtime Health Issues

- Validate **`GET /health`**, **`GET /live`**, **`GET /ready`**, and **`GET /version`** on the Forge process.
- Check logs for failing module names and request IDs.
- Isolate whether the issue is a local Forge module vs upstream SKIA-full contracts.

## Web IDE shows “assets not built”

- Run `npm run build` inside `skia-ide/` so `skia-ide/dist/renderer/` exists, then restart Forge and open `/forge/app`.

## Download redirects fail

- Confirm GitHub release assets exist (`SKIA_FORGE_RELEASE_REPO`, `SKIA_FORGE_RELEASE_TAG`, optional `GITHUB_TOKEN` / `SKIA_GITHUB_TOKEN`).
- Optional override: `SKIA_FORGE_LATEST_VERSION` for version-check UI.

## Auth from IDE or API client

- Auth requests go to **`POST /api/auth/login`**, **`POST /api/auth/register`**, **`GET /api/auth/session`** — proxied to **`SKIA_BACKEND_URL`** (default `https://api.skia.ca`).
- Static HTML pages intentionally omit marketing sign-in/register buttons; use the **Forge IDE** or API clients.
