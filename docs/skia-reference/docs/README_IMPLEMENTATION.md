# SKIA Implementation Guide

## What is currently implemented
- Backend orchestration and API routing run through `src/server.ts`.
- Frontend and mobile clients consume shared backend contracts.
- Desktop provides a secure shell over hosted SKIA web experience.
- Voice generation includes backend orchestration plus `services/tts` runtime.

## Maturity model
- `active`: production-capable and mounted/wired.
- `partial`: integrated but still missing operational hardening.
- `stub`: scaffolded interfaces with placeholder logic.

## Implementation priorities
- Keep contract compatibility across frontend/mobile/desktop.
- Promote scaffold services only after route wiring, tests, and observability exist.
- Keep security and credit middleware ordering consistent for all protected workflows.
