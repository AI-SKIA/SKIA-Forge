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

- `src/server.ts` - runtime entrypoint
- `src/forge/modules/` - module domains (governance, safety, work, context-engine, etc.)
- `skia-ide/` - IDE-facing integration surface

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
