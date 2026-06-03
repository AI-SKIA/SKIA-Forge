# Forge IDE local overrides

Files here mirror paths under `skia-ide/`. They are copied into the working tree **only** when you run:

```powershell
. .\local-dev\scripts\apply-forge-ide-local-patch.ps1
```

## Rules

- **Local dev only** — not used by Northflank, CI, or installer packaging.
- Keep overrides **minimal** (auth, chat, terminal, onboarding tweaks for localhost).
- Sync copy with production when you change shared UX (e.g. `agentHint` in locale JSON).
- Before `npm run build` for release or committing IDE changes: run `revert-forge-ide-local-patch.ps1` so `skia-ide/` matches git.

Marker file `.local-dev-ide-patch-applied` (gitignored) records that overrides were applied.
