# SKIA-Forge Troubleshooting

## Build/Test Failures

- Run:
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
- Fix schema/type mismatches before rerunning orchestration endpoints.

## SKIA-full Integration Unavailable

- Check `/integration/skia-full` and `/integration/skia-full/probe`.
- Verify upstream URL/env configuration.
- Review adapter disabled flags and auth headers.

## Governance Blocks

- Expected in strict or adaptive mode for risky actions.
- Read remediation recommendations and apply suggested safe path.
- Re-run request after remediation.

## Runtime Health Issues

- Validate `/health` and `/api/health/*`.
- Check logs for failing module names and request IDs.
- Isolate whether issue is local Forge module or upstream contract.
