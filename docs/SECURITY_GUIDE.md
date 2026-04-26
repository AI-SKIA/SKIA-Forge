# SKIA-Forge Security Guide

## Security Model

SKIA-Forge applies layered controls:

- request/schema validation
- governance mode enforcement
- safety gates for high-risk actions
- execution previews and policy-based blocking

## Key Security Components

- `SecurityAnalysisService` for scan and save-time checks
- governance decision engine for strict/adaptive/autonomous control
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
