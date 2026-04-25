# SKIA Forge Status

Last updated: 2026-04-24

## Phase 0 integration (intelligence layer in `C:\Skia-FULL`)

- The model/reasoning/multimodal/eval work package lives in the **Skia-FULL** monorepo: `REASONING_ENGINE_MODE`, `src/services/AdaptiveThinkingEngine.ts`, `TreeOfThoughtService.ts`, `MoERouterService.ts`, `POST /api/multimodal/analyze`, and `src/services/EvalRunnerService.ts` (see `exports/ROADMAP_PHASE_STATUS.md`).
- Forge’s own agent runtime under `src/forge/` is **independent** today; when `MoERouterService` and related services reach a stable **`active`** milestone in Skia-FULL, Forge will route its outbound intelligence calls through the same public/login API surface (never a browser-direct hop to the internal `backend:4000` host).

## Current IDE shell status

- `skia-ide` builds successfully with `npm run build`.
- Electron launches successfully with `npm start` (`electron dist/main/main.js`).
- Renderer is now wired to a strict three-column sovereign layout + bottom status bar.
- CSS is loaded through webpack via `index.ts` imports and applied to all shell surfaces.
- Sidebar logo, gold nav system, Monaco center workspace, chat panel, and status text are all present in the renderer template and styled to the SKIA foundation.

## Exact file list: `skia-ide/`

- `skia-ide/README.md`
- `skia-ide/assets/skia-icon.png`
- `skia-ide/package-lock.json`
- `skia-ide/package.json`
- `skia-ide/src/main/main.ts`
- `skia-ide/src/main/preload.ts`
- `skia-ide/src/renderer/editor/monacoSetup.ts`
- `skia-ide/src/renderer/global.d.ts`
- `skia-ide/src/renderer/index.html`
- `skia-ide/src/renderer/index.ts`
- `skia-ide/src/renderer/skia-dark.css`
- `skia-ide/src/renderer/skia/skiaApiClient.ts`
- `skia-ide/src/renderer/skia/skiaChatPanel.ts`
- `skia-ide/src/renderer/skia/skiaCommands.ts`
- `skia-ide/src/renderer/skia/skiaConfig.ts`
- `skia-ide/src/renderer/skia/skiaOnboarding.ts`
- `skia-ide/src/renderer/skia/skiaSessionStore.ts`
- `skia-ide/src/renderer/skia/skiaStatusBar.ts`
- `skia-ide/src/renderer/styles/app.css`
- `skia-ide/src/renderer/styles/skia-dark.css`
- `skia-ide/tsconfig.json`
- `skia-ide/tsconfig.main.json`
- `skia-ide/webpack.config.js`

## What still needs to be built

- Explorer/search/agent/forge/settings view content is still placeholder-only (nav state is visual).
- Chat stream currently appends raw chunks and should be upgraded to structured stream frame parsing.
- Workspace file tree/open/save integration is not yet implemented in renderer.
- Add smoke/E2E checks for startup layout, stylesheet presence, and chat controls.

## Next session starting point

1. Implement workspace/file model wiring (open folder -> render tree -> open file in Monaco -> track active file).
2. Harden chat streaming protocol handling with deterministic completion/error states.
3. Add a startup verification test that asserts:
   - primary background `#0a0a0a`
   - sidebar width `240px`
   - right panel width `360px`
   - status bar height `28px`
4. Add build-time check for brand token usage to prevent non-foundation colors from being introduced.

