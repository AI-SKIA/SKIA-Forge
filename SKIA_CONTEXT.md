# SKIA Context

## System context
SKIA is a multi-client platform with a single canonical backend runtime (`src/server.ts`) and domain-specific modules mounted behind that runtime. The frontend (Next.js), mobile (Expo), and desktop (Electron shell) all depend on this backend contract.

## Operational context
- Governance, policy, and security checks are enforced in backend middleware and service layers.
- Credit/billing controls are active and must be treated as first-class runtime dependencies.
- Voice capabilities are provided via backend orchestration and a dedicated TTS microservice.

## Evolution context
- Some OS and service areas are scaffold-level and documented as such.
- Documentation must distinguish active systems from roadmap systems to prevent architecture drift.
