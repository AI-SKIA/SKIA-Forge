# SKIA Operator Manual

## Modes

- Global mode: SKIA coordinates work across multiple repositories using global context, planning, governance, and evolution signals.
- Repo mode: SKIA operates inside a single repository with local work/dashboard/safety decisions.
- Analysis-only mode: SKIA computes plans, recommendations, dashboards, and audits without applying mutating execution.

## Core controls

### Pause global evolution

- Purpose: stop applying new global evolution/meta-optimization/consolidation changes.
- Entry point: `pauseGlobalEvolutionOnce(projectRoots)`.
- Effect: policy and safety flows treat evolution as paused; execution can still continue in constrained or analysis-only mode.

### Resume global evolution

- Purpose: re-enable global evolution and meta-optimization flow.
- Entry point: `resumeGlobalEvolutionOnce(projectRoots)`.
- Use after reviewing global health, governance, and convergence.

### Freeze all heuristics

- Purpose: prevent heuristic weight/threshold evolution changes.
- Entry point: `freezeAllHeuristicsOnce(projectRoots)`.
- Effect: self-improvement can still analyze and recommend but cannot mutate heuristics.

### Freeze all strategy profiles

- Purpose: lock strategy-profile evolution/mapping churn.
- Entry point: `freezeAllStrategyProfilesOnce(projectRoots)`.
- Effect: execution continues with stable strategy mappings.

### Enable analysis-only mode

- Purpose: force no-write operation mode.
- Entry point: `enableAnalysisOnlyModeOnce(projectRoots)`.
- Effect: safety gateway returns `analysisOnly`; global/repo mutation paths are blocked.

### Disable analysis-only mode

- Purpose: re-enable mutating execution (still bounded by safety/policy).
- Entry point: `disableAnalysisOnlyModeOnce(projectRoots)`.

### Trigger global baseline consolidation

- Purpose: freeze stable global heuristic/strategy/architecture signals as baselines.
- Entry point: `triggerGlobalBaselineConsolidationOnce(projectRoots)`.
- Use after sustained stability and healthy convergence.

### Set global risk profile

- Profiles: `conservative`, `balanced`, `aggressive`.
- Entry point: `setGlobalRiskProfileOnce(projectRoots, profile)`.
- Effect: policy evaluation tightens or loosens allowable operations.

## Safe operation playbook

### First run in a new environment

1. Set risk profile to `conservative`.
2. Enable analysis-only mode.
3. Run global orchestration in analysis-only and inspect dashboard/audits.

### Before enabling writes

Validate all of the following:

- Global evolution health is not critical.
- Global governance is not failing.
- Global health surface has no severe instability or fragmentation risks.

### Incident or unexpected behavior

Immediately:

1. `pauseGlobalEvolutionOnce(...)`
2. `enableAnalysisOnlyModeOnce(...)`

Then inspect:

- latest safety gateway decisions
- operator panel in global dashboard
- recent `auto.controller.tick` and `global.auto.tick` audits
