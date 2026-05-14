# SKIA Forge Support

SKIA Forge support covers the following areas:

## Support Scope

Support covers:

- runtime startup and health issues
- integration contract failures
- governance and policy flow debugging
- workflow failures and integration issues

## Triage Information to Collect

- endpoint and method (if using HTTP APIs)
- request timestamp
- request ID / correlation ID (if available)
- what you were trying to do when the issue occurred
- error message and reproduction steps

## Escalation Path

1. Reproduce locally and validate with health/probe endpoints.
2. Apply remediation guidance from control-plane outputs.
3. Escalate with logs, payload shape, and expected vs actual behavior.

## Enterprise Support Expectations (template)

- P1 critical outage: immediate response window
- P2 degraded service: same business day response
- P3 non-blocking issue: prioritized backlog response
