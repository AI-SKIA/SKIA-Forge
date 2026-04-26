# Changelog

All notable changes to SKIA-Forge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- Cleanup pass removed non-Forge root artifacts copied from adjacent repositories.
- Runtime-generated `.skia` artifacts were explicitly ignored in `.gitignore`.
- Status and phase documentation were reconciled to current operational maturity.
- Architecture inventory and baseline-refresh documentation were updated.

## [2026-04-25] - Cleanup and baseline normalization

### Added
- `docs/architecture/BASELINE_REFRESH_RUNBOOK.md` for baseline lifecycle operations.
- `docs/CHANGELOG.md` as canonical historical change log.

### Changed
- `SKIA_FORGE_STATUS.md` updated from placeholder planning language to current runtime posture.
- `IMPLEMENTATION_PHASES.md` reconciled to completed-phase reality.
- `docs/skia-reference/docs/architecture/repo-inventory.json` regenerated from live repo state.

### Removed
- Legacy copied root artifacts not part of Forge runtime architecture (including old SKIA-FULL audit/context carryovers and visual summary leftovers).

## [2026-04-24] - Sovereign posture and control-plane maturity

### Added
- Control-plane and governance posture capabilities through late-phase implementation sequence.
- Extended telemetry, remediation, and signed-intent lifecycle features in Forge module runtime.

### Changed
- Platform shell and module operations stabilized as active execution surface.

## [2026-04-22] - Architecture blueprint and Phase 1 foundations

### Added
- `SKIA-IDE_Architecture_Blueprint.md` (v1.0.0) as foundational architecture design record.
- Initial phased implementation planning and context-engine execution direction.

## [2026-04-16] - Initial repository inventory snapshot

### Added
- Initial architecture inventory JSON reference under `docs/skia-reference/docs/architecture/`.

