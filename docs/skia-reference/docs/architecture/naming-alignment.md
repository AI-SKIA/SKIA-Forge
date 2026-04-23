# SKIA Naming Alignment

## Canonical terms
- **Primary API runtime**: `src/server.ts` backend.
- **Next API proxy layer**: `frontend/pages/api/*`.
- **Client applications**: `frontend`, `mobile`, `desktop`.
- **Operator modules**: `skia-*` mounted backend module families.
- **Credit billing system**: Stripe + credits/tier middleware.

## Terms to avoid
- Avoid calling proxy handlers "core backend engines".
- Avoid claiming scaffold modules are "production autonomous systems".
- Avoid mixed labels for the same subsystem across docs.

## Documentation convention
- Every architecture doc should include explicit status tags: `active`, `partial`, `stub`.
- Use the same subsystem names in backend, frontend, mobile, OS, and service docs.
