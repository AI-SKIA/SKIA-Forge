# SKIA-Forge Investor Guide

## Ecosystem boundary

Present Forge as one part of the SKIA ecosystem:

- `SKIA-Forge`: governance/orchestration control plane
- `Skia-FULL`: core runtime and product delivery
- `Skia-Status`: public operational transparency

## One-line thesis
SKIA-Forge is the orchestration and governance control plane for AI-native software development, turning ad-hoc AI coding into measurable, policy-safe execution.

## Problem
- AI coding tools improve speed but create governance risk, inconsistent quality, and weak operational visibility.
- Teams cannot reliably answer: what changed, why it changed, and whether it violated policy.
- Enterprise adoption stalls when AI output is not auditable.

## SKIA-Forge solution
- Unified control plane for planning, execution preview, governance, and remediation.
- Policy-aware orchestration across modules (context, safety, work planning, architecture, healing).
- Contract-based integration with SKIA runtime intelligence (`/integration/skia-full/*`).
- Operational APIs for health, posture, and audit-friendly recommendations.
- SKIA Forge IDE (desktop) for authenticated developer workflows; Forge HTTP serves control-plane APIs, downloads, and docs (`docs/API_REFERENCE.md`).

## Why now
- AI-assisted development is mainstream, but trust and control lag behind.
- Buyers are moving from "best assistant output" to "repeatable AI operations."
- Governance and reliability are becoming budgeted line items.

## Product proof points
- Typed request/response contracts with schema validation.
- Control-plane recommendation and remediation pipeline.
- End-to-end tests passing on core governance and orchestration paths.
- Explicit handling for strict/adaptive/autonomous operational modes.

## Business model direction
- Developer/Team/Enterprise SaaS tiers aligned with governance depth and scale.
- Potential usage-based expansion via orchestration volume, policy modules, and advanced telemetry.
- Enterprise services: deployment hardening, policy integration, and compliance exports.

## Defensibility
- Governance-first architecture (not just generation quality).
- Deep integration between orchestration, enforcement, and runtime health.
- Operational data flywheel from posture alerts, remediation outcomes, and work planning telemetry.

## Demo storyline for investors (10 minutes)
1. Show baseline project health and governance posture.
2. Trigger orchestration on a realistic change request.
3. Show strict-mode block + recommended remediation.
4. Apply remediation and re-run to healthy posture.
5. Close with auditability and enterprise readiness.

## Key investor questions to pre-answer
- What is the wedge? Governance and control plane, not generic chat.
- What expands ACV? Team controls, policy packs, enterprise compliance.
- Why can this win? Measurable trust and operational reliability in AI development workflows.
