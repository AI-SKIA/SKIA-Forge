# Global Audit Stream Schema

## Common envelope

Every audit event should include:

- `timestamp` (ISO-8601)
- `eventId` (UUID)
- `category` (for example: `safety`, `policy`, `operator`, `global`, `self`, `auto`)
- `eventType` (for example: `safety.global.check`)
- `severity` (`info | warning | error | critical`)
- `projectRoot` or `projectRoots`
- `repoId` (optional)
- `correlationId` (run/cycle trace key)
- `payload` (category-specific)

## Category payloads

### `safety.*`

Events: `safety.global.check`, `safety.global.halt`, `safety.gateway.*`

Payload fields:

- `safetyStatus`
- `gatewayStatus` (gateway events)
- `violatedRules[]`
- `violatedPolicies[]`
- `requiredApprovals[]`
- `recommendedOperatorActions[]`

### `policy.*`

Event: `policy.global.evaluate`

Payload fields:

- `policyStatus`
- `riskProfile`
- `blockedActions[]`
- `requiredApprovals[]`
- `policyNotes[]`

### `operator.*`

Events: `operator.action.start`, `operator.action.complete`

Payload fields:

- `actionName`
- `initiator` (optional)
- `previousState`
- `newState`
- `parameters` (for example `riskProfile`)

### `global.*`

Events include: `global.auto.*`, `global.plan`, `global.governance`, `global.dashboard.build`, `global.evolution.health`, `global.metaOptimization.*`

Payload fields:

- `globalRisk`
- `globalDrift`
- `globalHotspots[]`
- `globalEvolutionScore`
- `healthCategory`
- `governanceStatus`
- `metaOptimizationSummary` (if present)
- `haltReason` (for halts)

### `self.*`

Events include: `self.loop.tick`, `self.health`, `self.metaOptimization.*`

Payload fields:

- self-state summary or key scores
- `metaStabilityScore`
- `metaRiskScore`
- `metaEfficiencyScore`
- `architectureImprovementScore`

### `auto.*`

Events include: `auto.controller.tick`, `auto.session.start`, `auto.session.complete`

Payload fields:

- `mode` (`repo | global`)
- `metaOptimizationMode`
- `globalMode`
- `cycleNumber`
- `halted` + `haltReason`
- `workItemsSummary` (counts/aggregates, not full details)

## Stream usage

- Storage: structured sink such as JSONL, ELK, or OpenTelemetry pipeline.
- Correlation: propagate one `correlationId` from entry points through controller/orchestrator/safety/policy/meta layers.
- External integrations:
  - dashboards in Grafana/Kibana
  - alert rules on `severity=critical` or `gatewayStatus=halt`
  - compliance replay using correlation-linked event chains
