# SKIA Forge Documentation

This directory contains the core product documentation set for SKIA Forge, the SKIA ecosystem control plane.

**Release baseline:** Forge server and documentation set target **`1.0.0`** (see root `package.json`). Desktop **SKIA Forge IDE** is also **`1.0.0`**.

## Ecosystem context

- SKIA runs the core product runtime and user-facing application surfaces.
- SKIA Forge governs orchestration, safety, policy, and execution flows via **`SkiaFullAdapter`** calls into SKIA HTTP contracts — it does **not** replace the product runtime.
- `Skia-Status` provides public-facing operational transparency.

Documents in this folder must describe Forge as a control plane, not as a replacement for the full product runtime.

## Deployment surfaces (where this documentation applies)

- **Forge Node server** (the Forge server): HTTP API + static docs; default **`SKIA_PORT=4173`**. Production hostname **`forge.skia.ca`** [CONFIRM] against your hosting provider's domain mapping.
- **Packaged SKIA Forge IDE**: Electron desktop client; **sign-in / registration occur in-app**, not on marketing HTML.
- **Public site routes**: downloads canonical on **`https://forge.skia.ca/platform-downloads`** (the SKIA platform); Forge redirects `/`, `/forge`, `/download` there. Installers: **`GET /api/app/download`** and **`GET /api/app/download/:platform`**. Also `/forge/app` (web IDE bundle), `/resources`, `/security`, `/contact`, `/docs/*`.
- **Canonical API index:** `API_REFERENCE.md` (kept in sync with the Forge server).

## Documents

- `PRODUCT_MANUAL.md` - product overview, capabilities, and positioning
- `USER_GUIDE.md` - operator and user workflows
- `DEVELOPER_GUIDE.md` - local development and architecture conventions
- `OPERATOR_MANUAL.md` - deployment and runtime operations
- `API_REFERENCE.md` - primary Forge API surfaces
- `SECURITY_GUIDE.md` - security model and controls
- `TROUBLESHOOTING.md` - common failure modes and fixes
- `CHANGELOG.md` - versioned product change history
- `SUPPORT.md` - support model and escalation path
- `QUICKSTART.md` - 5-minute setup and first workflow
- `PRICING_AND_PACKAGES.md` - product packaging and commercial model
- `ENTERPRISE_READINESS_CHECKLIST.md` - enterprise launch/pilot readiness checklist

## Filename intent rule

If a file name implies broad scope (`README`, `MANUAL`, `GUIDE`, `REFERENCE`), the opening section must state:

1. What Forge is.
2. What Forge is not.
3. How it integrates with SKIA and `Skia-Status`.
