# SKIA-Forge Product Manual

## What SKIA-Forge Is

SKIA-Forge is the governance and orchestration control plane for AI-native software development in the SKIA ecosystem. It coordinates planning, execution safety, architecture checks, and remediation guidance around AI-assisted workflows.

## What SKIA-Forge Is Not

SKIA-Forge is not the full end-user product runtime. Product APIs, web/mobile/desktop delivery, and customer-facing feature execution live in `Skia-FULL`.

Public operational communication lives in `Skia-Status`, not in Forge runtime endpoints.

## Who It Is For

- AI-first engineering teams
- Platform and developer productivity teams
- Security/governance stakeholders who need policy-aware automation

## Core Product Capabilities

- Structured orchestration flows across Forge modules
- Governance mode controls (`strict`, `adaptive`, `autonomous`)
- Runtime control-plane posture, alerts, and recommendations
- Safety and architecture diagnostics
- SKIA runtime contract integration via `/integration/skia-full/*`

## Value Proposition

- Faster delivery with guardrails
- Reduced unsafe operations reaching production
- Better traceability for enterprise governance and audits

## Product Boundaries

SKIA-Forge is a control and orchestration layer. It is not a replacement for your full application runtime; it integrates with upstream SKIA intelligence contracts and your existing deployment topology.
