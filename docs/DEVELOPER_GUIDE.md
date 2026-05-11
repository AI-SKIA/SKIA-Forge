# SKIA Forge Developer Guide

## Ecosystem boundaries

- SKIA Forge is the control-plane codebase (**`1.0.0`**). Upstream intelligence calls go through **`SkiaFullAdapter`** to **`SKIA_FULL_API_URL`** (default **`https://api.skia.ca`**); Forge does not replace SKIA as the product runtime.
- SKIA remains the product runtime and customer feature surface.
- `Skia-Status` remains the public operational publication surface.

## Local Setup

- Node.js 20+
- `npm install`
- `npm run build`
- `npm run test`

## Project Structure (Core)

- the Forge server — runtime entrypoint (binds **`SKIA_PORT`**, default **4173**)
- `src/forge/modules/` - module domains. **Live in server mount path:** `context-engine`, `agent-planner`, `agent-executor`, `production`, `healing`, `architecture`, `skiarules`, `security`, `sdlc`, `tools`. **Scaffolded / not directly mounted [CONFIRM]:** `agent`, `auto`, `global`, `self`, `work`, `governance` (module folder), `safety`, `errors`.
- SKIA Forge IDE — Electron + renderer (**`1.0.0`**); run `npm run build` in that package before `/forge/app` can load in the browser
- `public/docs/` - branded HTML documentation served at `/docs/*.html` (takes precedence over `docs/*.md`)

## HTTP surfaces (quick)

- `/`, `/forge`, `/download` → redirect **`https://forge.skia.ca/platform-downloads`** (download UI on the SKIA platform)
- `/api/app/download`, `/api/app/download/:platform` → desktop installer redirects (GitHub releases; default repo `AI-SKIA/SKIA-Forge`)
- `/forge/app` - web IDE (requires built SKIA Forge IDE renderer bundle)
- `/api/forge/*` - control plane (**authenticated**; see `API_REFERENCE.md`)
- `/integration/skia-full/*` - adapter probes and passthroughs

## Development Workflow

1. Implement scoped changes in `src/forge/modules/*`.
2. Run `npm run lint`, `npm run typecheck`, `npm run test`.
3. Validate integration routes and control-plane behavior.

## Coding Conventions

- Use typed request/response schemas.
- Keep policy checks explicit and test-covered.
- Prefer additive changes over implicit behavior.

## Integration Notes

Forge can run with SKIA integration enabled or disabled; adapter paths should fail clearly when upstream contracts are unavailable.

## Platform integration

### Forge governance vs platform operation tokens

**`ApprovalTokenStore`** (`src/approvalTokens.ts`) issues short-lived random tokens for **Forge control-plane** workflows. Purposes are coarse (`any`, `module`, `orchestration`, `remediation`). **`consume(token, purpose)`** checks purpose compatibility and expiry only—there is **no** binding to user id, device fingerprint, risk band, or a hash of request parameters.

**`OperationTokenService`** (SKIA `src/epaas/OperationTokenService.ts`) issues **one-time** tokens for **product runtime** routes. Each row binds **`userId`**, **`deviceFingerprint`**, **`riskBand`**, **`actionType`**, and a **parameters hash** derived from the JSON body. Validation happens in **`requireOperationToken`** middleware using the **`X-Operation-Token`** and **`X-Device-Fingerprint`** headers.

Use **approval tokens** when implementing Forge governance flows that already call **`POST /api/forge/approval-token`** and pass **`approvalToken`** into remediation-style bodies. Use **platform operation tokens** when implementing destructive SKIA APIs that participate in the platform route/token pipeline—they are different trust domains and must not be substituted for each other.

### Reading platform adversary events in the Forge audit log

Forge stores audit rows via **`appendAuditLog`**. For platform-shaped adversary telemetry, use **`appendEpaasEvent`** from **`src/auditLog.ts`**: it writes **`action`** values such as **`epaas.honey_trigger`** (pattern **`epaas.<eventType>`**) and sets **`parameters.epaas: true`**, **`parameters.category: "epaas"`**, plus **`eventId`**, **`riskBandAtEvent`**, and **`detail`**.

To read events locally, call **`readAuditLog(projectRoot)`** and filter rows where **`typeof record.action === "string"`** and **`record.action.startsWith("epaas.")`**, or where **`parameters`** includes **`category: "epaas"`** depending on your parser.

### `verifySensitiveIntent` vs platform operation tokens

**`verifySensitiveIntent`** (implemented in **the Forge server**) gates sensitive **Forge** HTTP handlers. It requires **`x-skia-intent-signature`**, **`x-skia-intent-ts`**, and **`x-skia-intent-nonce`**, and verifies them with **`intentVerifier.verifyIntent`** against the declared intent name and JSON body. Failure returns **401** with a short **`reason`**.

**Platform operation tokens** are a separate mechanism: UUID **`X-Operation-Token`**, device fingerprint header, and **`OperationTokenService`** consumption tied to **`actionType`** and hashed parameters.

Conceptually both are **second-step / proof-of-intent** layers on top of normal auth, but they operate on **different codebases and headers**. Integrations that touch Forge use **`verifySensitiveIntent`** (and optionally **`ApprovalTokenStore`**); integrations that touch SKIA platform-protected APIs use **`OperationTokenService`** after those routes are mounted per SKIA's platform integration steps.
