# SKIA-Forge Support

## Support Scope

Support covers:

- runtime startup and health issues
- integration contract failures
- governance and policy flow debugging
- build/test pipeline breakages

## Triage Information to Collect

- endpoint and method
- request timestamp
- request ID / correlation ID (if available)
- mode (`strict` / `adaptive` / `autonomous`)
- error message and reproduction steps

## Escalation Path

1. Reproduce locally and validate with health/probe endpoints.
2. Apply remediation guidance from control-plane outputs.
3. Escalate with logs, payload shape, and expected vs actual behavior.

## Enterprise Support Expectations (template)

- P1 critical outage: immediate response window
- P2 degraded service: same business day response
- P3 non-blocking issue: prioritized backlog response
