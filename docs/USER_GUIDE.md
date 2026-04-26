# SKIA-Forge User Guide

## Quick Start

1. Install dependencies:
   - `npm install`
2. Start Forge:
   - `npm run dev`
3. Validate health:
   - `GET /health` and `/api/health/*` endpoints

## Typical Workflow

1. Submit context and goals to Forge endpoints.
2. Review orchestration stage decisions.
3. If blocked, apply recommended remediation.
4. Re-run flow until posture is healthy.

## Daily Usage Patterns

- Use control-plane summaries before major changes.
- Use execution preview before high-risk actions.
- Use architecture and safety diagnostics on changed files.

## Best Practices

- Keep governance mode aligned to environment risk.
- Treat blocked actions as policy feedback, not errors.
- Run build/test after major orchestration outputs.
