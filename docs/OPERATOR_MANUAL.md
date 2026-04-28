# SKIA-Forge Operator Manual

## Runtime Role

SKIA-Forge operates as an orchestration/governance runtime service that augments development workflows with policy-aware controls.

## Ownership boundaries

- Operate Forge as a control-plane service.
- Do not treat Forge endpoints as replacements for `Skia-FULL` product runtime APIs.
- Use `Skia-Status` for external/public incident communication.

## Deployment Baseline

- Build: `npm run build`
- Start: `npm run dev` (or production process command)
- Validate health endpoints after startup

## Environment and Secrets

- Keep all secrets in environment management (never committed)
- Configure SKIA integration values per deployment environment
- Use explicit mode controls for strict vs adaptive operations

## Operational Checks

- Health checks pass
- Control-plane posture shows expected mode
- Governance recommendations are readable and actionable
- Audit logs are being produced

## Incident Handling

1. Capture failure endpoint and payload metadata.
2. Review control-plane recommendations.
3. Apply remediation and re-run.
4. Escalate with logs and request IDs if unresolved.
