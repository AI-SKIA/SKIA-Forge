# SKIA-Forge Developer Guide (Sell-to-Developer)

## Positioning boundary

Sell Forge as developer governance/orchestration control layer that complements `Skia-FULL` runtime development rather than replacing product APIs.

## Positioning to developers
SKIA-Forge is the layer that keeps AI-assisted coding fast **without losing control**.

## What developers care about
- Speed without breaking production.
- Confidence in generated/refactored code.
- Low-friction workflows, not another heavyweight process.

## Core value for developers
- Structured planning + execution preview before risky changes.
- Built-in guardrails for destructive operations and unsafe paths.
- Context-aware retrieval and architecture diagnostics.
- Safety/gov decisions surfaced as actionable feedback, not vague warnings.

## "Why switch?" talk track
- Existing AI coding tools optimize response quality.
- Forge optimizes **delivery reliability** and **team safety**.
- You still move quickly, but with policy and audit support ready for scale.

## Developer onboarding flow
1. Install project dependencies.
2. Run Forge locally (`npm run dev`).
3. Validate with `npm run build` and `npm run test`.
4. Connect SKIA runtime contracts (`/integration/skia-full` health).
5. Start using orchestration and governance endpoints in daily workflows.

## Practical demo for developers
- Submit a change request to orchestration.
- Inspect stage decisions and blocked operations.
- Apply suggested remediation.
- Re-run and show successful safe execution.

## Objection handling
- "Will this slow me down?"  
  It front-loads checks to reduce rollback/debug time later.
- "Can I still work manually?"  
  Yes; Forge augments workflows and can run in different control modes.
- "Is this just policy theater?"  
  No; policy decisions are tied to execution paths and testable outcomes.

## Developer ROI
- Fewer unsafe edits reaching shared branches.
- Faster root-cause analysis with explicit decision traces.
- Better collaboration between builders and platform/security teams.
