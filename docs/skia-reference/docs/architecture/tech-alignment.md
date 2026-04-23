# SKIA Technical Alignment

## Canonical runtime model
- Primary API runtime: Express application in `src/server.ts`.
- Web UI runtime: Next.js in `frontend/`.
- Mobile runtime: Expo app in `mobile/`.
- Desktop runtime: Electron shell in `desktop/`.

## Integration alignment
- Frontend API handlers are proxy adapters, not the canonical business logic layer.
- Backend routes/services own policy enforcement, moderation, credits, and orchestration.
- Voice features are split between backend orchestration and `services/tts` microservice.

## Naming standards
- Use "Primary API runtime" for backend.
- Use "Next API proxy layer" for `frontend/pages/api/*`.
- Use "Scaffold service" only for modules that are intentionally non-production.

## Drift prevention
- Update docs when routes, middleware order, or service contracts change.
- Keep web/mobile/desktop integration docs synchronized with shared endpoint behavior.
