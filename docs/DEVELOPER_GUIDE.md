# SKIA-Forge Developer Guide

## Ecosystem boundaries

- `SKIA-Forge` is the control-plane codebase.
- `Skia-FULL` remains the product runtime and customer feature surface.
- `Skia-Status` remains the public operational publication surface.

## Local Setup

- Node.js 20+
- `npm install`
- `npm run build`
- `npm run test`

## Project Structure (Core)

- `src/server.ts` - runtime entrypoint (binds **`SKIA_PORT`**, default **4173**)
- `src/forge/modules/` - module domains (governance, safety, work, context-engine, etc.)
- `skia-ide/` - Electron + renderer for **SKIA Forge IDE**; run `npm run build` here before `/forge/app` can load in the browser
- `public/docs/` - branded HTML documentation served at `/docs/*.html` (takes precedence over `docs/*.md`)

## HTTP surfaces (quick)

- `/`, `/forge`, `/download` → redirect **`https://skia.ca/platform-downloads`** (download UI: `Skia-FULL` `frontend/pages/platform-downloads.tsx`)
- `/forge/app` - web IDE (requires built `skia-ide/dist/renderer`)
- `/api/forge/*` - control plane (see `API_REFERENCE.md`)
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

Forge can run with SKIA-full integration enabled or disabled; adapter paths should fail clearly when upstream contracts are unavailable.

## EPAAS Integration

### Forge governance vs Skia-FULL EPAAS tokens

**`ApprovalTokenStore`** (`src/approvalTokens.ts`) issues short-lived random tokens for **Forge control-plane** workflows. Purposes are coarse (`any`, `module`, `orchestration`, `remediation`). **`consume(token, purpose)`** checks purpose compatibility and expiry only—there is **no** binding to user id, device fingerprint, risk band, or a hash of request parameters.

**`OperationTokenService`** (Skia-FULL `src/epaas/OperationTokenService.ts`) issues **one-time** tokens for **product runtime** routes. Each row binds **`userId`**, **`deviceFingerprint`**, **`riskBand`**, **`actionType`**, and a **parameters hash** derived from the JSON body. Validation happens in **`requireOperationToken`** middleware using the **`X-Operation-Token`** and **`X-Device-Fingerprint`** headers.

Use **approval tokens** when implementing Forge governance flows that already call **`POST /api/forge/approval-token`** and pass **`approvalToken`** into remediation-style bodies. Use **EPAAS operation tokens** when implementing destructive Skia-FULL APIs that participate in the EPAAS route/token pipeline—they are different trust domains and must not be substituted for each other.

### Reading EPAAS adversary events in the Forge audit log

Forge stores audit rows via **`appendAuditLog`**. For EPAAS-shaped adversary telemetry, use **`appendEpaasEvent`** from **`src/auditLog.ts`**: it writes **`action`** values such as **`epaas.honey_trigger`** (pattern **`epaas.<eventType>`**) and sets **`parameters.epaas: true`**, **`parameters.category: "epaas"`**, plus **`eventId`**, **`riskBandAtEvent`**, and **`detail`**.

To read events locally, call **`readAuditLog(projectRoot)`** and filter rows where **`typeof record.action === "string"`** and **`record.action.startsWith("epaas.")`**, or where **`parameters`** includes **`category: "epaas"`** depending on your parser.

### `verifySensitiveIntent` vs EPAAS operation tokens

**`verifySensitiveIntent`** (declared in **`src/server.ts`**) gates sensitive **Forge** HTTP handlers. It requires **`x-skia-intent-signature`**, **`x-skia-intent-ts`**, and **`x-skia-intent-nonce`**, and verifies them with **`intentVerifier.verifyIntent`** against the declared intent name and JSON body. Failure returns **401** with a short **`reason`**.

Skia-FULL **EPAAS operation tokens** are a separate mechanism: UUID **`X-Operation-Token`**, device fingerprint header, and **`OperationTokenService`** consumption tied to **`actionType`** and hashed parameters.

Conceptually both are **second-step / proof-of-intent** layers on top of normal auth, but they operate on **different codebases and headers**. Integrations that touch Forge use **`verifySensitiveIntent`** (and optionally **`ApprovalTokenStore`**); integrations that touch Skia-FULL EPAAS-protected APIs use **`OperationTokenService`** after those routes are mounted per Skia-FULL’s EPAAS integration steps.
