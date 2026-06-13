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

- All Forge API routes require authentication. Sign in via the SKIA Forge IDE or your API client.
- Forge exposes **`POST /api/auth/login`**, **`POST /api/auth/register`**, and **`GET /api/auth/session`** for the **SKIA Forge IDE**, automation, and API clients — not for anonymous public marketing pages.
- **Static Forge pages** (`/resources`, `/security`, `/contact`, `/docs/*`) and the canonical download surface at **`https://forge.skia.ca/platform-downloads`** intentionally omit **Sign in** and **Register** web CTAs; end users **create accounts and sign in inside the desktop IDE** (or other trusted clients).

## Key Security Components

- security analysis for scan and save-time checks
- governance layer for strict/adaptive/autonomous control
- safety modules for route and action-level constraints

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
