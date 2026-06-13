# SKIA Forge Product Manual

**Versions:** Forge server **`1.0.0`** · SKIA Forge IDE **`1.0.0`**.

## What SKIA Forge Is

SKIA Forge is the governance and orchestration control plane for AI-native software development in the SKIA ecosystem. It coordinates planning, execution safety, architecture checks, and remediation guidance around AI-assisted workflows. SKIA Forge connects to the SKIA intelligence APIs to power its orchestration flows — it does **not** replace the full SKIA product runtime where customer features live.

## Who It Is For

- AI-first engineering teams
- Platform and developer productivity teams
- Security and governance stakeholders who need policy-aware automation

## Core Product Capabilities

- Structured orchestration across context, agent, SDLC, production, healing, architecture, and related modules
- Governance mode controls (`strict`, `adaptive`, `autonomous`)
- Runtime control-plane posture, alerts, and recommendations
- Safety and architecture diagnostics
- Integration with SKIA intelligence services for reasoning, routing, and execution support

## Value Proposition

- Faster delivery with guardrails
- Reduced unsafe operations reaching production
- Better traceability for enterprise governance and audits

## Product Boundaries

SKIA Forge is a control and orchestration layer. It coordinates how AI-assisted work is planned, checked, and applied; your full application runtime and customer-facing surfaces remain in SKIA and your own infrastructure.

## Delivery surfaces (current)

- **Forge web host** — public download and documentation at **`https://forge.skia.ca`**, including **`/platform-downloads`**, **`/resources`**, **`/security`**, **`/contact`**, and **`/docs/*`**. Account **sign-in and registration** are not promoted on static marketing pages; users authenticate in the **SKIA Forge IDE** or other supported clients.
- **Web IDE shell** — **`/forge/app`** serves the SKIA Forge IDE in the browser with a compatibility layer for users who do not install the desktop app.
- **Desktop IDE** — **SKIA Forge** (desktop) is the primary interactive surface for developers working on local repositories.
- **Installers** — **`GET /api/app/download`** and **`GET /api/app/download/:platform`** redirect to published release assets for each supported platform.
