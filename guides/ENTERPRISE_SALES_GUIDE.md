# SKIA-Forge Enterprise Sales Guide

## Enterprise value proposition
SKIA-Forge enables enterprise AI development with governance, traceability, and operational control built in.

## Executive summary
- Problem: AI accelerates coding but increases policy, security, and compliance risk.
- Solution: Forge adds a governable control plane between AI intent and production execution.
- Outcome: safer velocity, stronger audit posture, and clearer accountability.

## Enterprise requirements Forge addresses
- Policy enforcement before high-risk operations.
- Observable orchestration decisions and remediation history.
- Health/posture endpoints for runtime and governance status.
- Controlled operation modes for different environments (strict/adaptive/autonomous).

## Security and governance posture
- Schema-validated request surfaces.
- Explicit gatekeeping around destructive commands.
- Decision telemetry for post-incident and compliance reviews.
- Structured remediation recommendations and execution hooks.

## Deployment model
- Northflank-aligned service topology (frontend/login/backend/TTS and supporting services).
- Runtime contract integration via SKIA-full endpoints.
- Works as control layer without requiring full rewrite of existing SDLC.

## Enterprise buying triggers
- AI policy mandates from security/legal.
- Need for auditable AI-assisted code changes.
- Scaling AI development beyond individual contributors.
- Incident history linked to ungoverned AI changes.

## Proof-of-value plan (30 days)
1. Week 1: install + baseline posture and policy mapping.
2. Week 2: pilot on selected repos/workflows.
3. Week 3: measure blocked-risk events, remediation time, and delivery throughput.
4. Week 4: executive readout + rollout plan.

## Success metrics
- Reduction in unsafe change attempts reaching review/merge.
- Faster remediation cycle time.
- Improved release confidence and fewer rollback events.
- Compliance readiness for AI-assisted engineering workflows.

## Procurement package checklist
- Architecture overview and integration map.
- Security controls and policy matrix.
- Operational runbooks (deployment, health checks, rollback).
- Pilot scope, SLAs, support model, and commercial terms.
