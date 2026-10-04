# SKIA Forge Security Guide

## Security scope

This guide covers security controls for Forge control-plane services and governance behavior.

## Security Model

SKIA Forge applies layered controls:

- request/schema validation
- governance mode enforcement
- safety gates for high-risk actions
- execution previews and policy-based blocking

## Authentication and accounts

Not every HTTP path requires a session. Auth posture by surface:

**Public (no Bearer JWT):**

- `GET /health`, `GET /version`
- `GET /api/app/*` (version-check, release assets, download redirects, release verification)
- `GET /api/public/status-metrics`
- Auth proxy endpoints used by the IDE and clients: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/contact`, `GET /api/auth/session`, `GET /api/auth/handoff`
- Browser/static pages: `/`, `/forge`, `/download` → `/platform-downloads`, `/forge/app`, `/forge/platform`, `/forge/sign-in`, `/chat`, `/resources`, `/security`, `/contact`, `/docs/*`, and related static assets

**Authenticated (Bearer JWT required):**

- Every route under `/api/forge/*` (model and embedding calls also require a paid Forge plan)
- `/live`, `/ready`, `/state/runtime`, `/index`, `/search`, `/agent/*`, `/rpc`, `/sovereign-core`, `/integration/skia-full/*`, `/providers/*`, `/telemetry/*`, `/rules`, `/diff/preview`, and related control-plane POSTs
- `/api/local/*` is open to same-machine (loopback) callers only; anyone else needs a Bearer JWT

Sign in via the SKIA Forge IDE or your API client. **Static Forge pages** (`/resources`, `/security`, `/contact`, `/docs/*`) and the canonical download surface at **`https://forge.skia.ca/platform-downloads`** intentionally omit **Sign in** and **Register** web CTAs; end users create accounts and sign in inside the desktop IDE (or other trusted clients).

## Key Security Components

- security analysis for scan and save-time checks
- governance layer for strict/adaptive/autonomous control
- safety modules for route and action-level constraints

## Agent Terminal Commands

- Agent commands containing `rm`, `del`, `format`, `shutdown`, `drop` or `truncate` are held until you approve them.
- Agent commands must be a single line and run inside the open project folder.
- Every terminal command is recorded in `.skia/agent-log.json` (action `tool.run_terminal`) with its source, outcome, exit code and duration. Command output is not stored.

## Operational Security Practices

- Keep secrets out of repository and logs
- Validate all external integration responses
- Treat policy blocks as first-class security events
- Record and monitor remediation outcomes

## Hardening Checklist

- Run lint/typecheck/tests before release
- Keep dependency updates current
- Validate integration probe endpoints regularly
- Review audit trails after major orchestration runs
