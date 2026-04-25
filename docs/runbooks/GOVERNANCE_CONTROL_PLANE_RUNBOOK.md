# Governance Control Plane Operations Runbook

## Scope

Operational steps for governance mode changes, gate enforcement, and controlled execution in Forge.

## Standard Flow

1. Confirm requested operation and policy impact.
2. Validate governance mode and required approvals.
3. Execute through guarded control-plane endpoints.
4. Record decision/action in audit trail.
5. Verify post-action system state.

## Failure Handling

- On policy conflict, stop execution and return a structured violation response.
- Preserve audit evidence for every denied or forced action.
