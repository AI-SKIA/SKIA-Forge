# SKIA-Forge API Surface and Contracts

## API Purpose

- Expose governance, planning, orchestration, and integration controls for Forge runtime operations.

## Contract Boundaries

- Forge runtime endpoints must remain explicit about auth, approval, and audit behavior.
- Upstream intelligence calls are adapter-based and should not bypass control-plane checks.

## Contract Evolution Rules

- Additive changes first, breaking changes behind versioning.
- Every new endpoint should document request schema, response schema, and failure modes.
