# Sovereign integrated platform — agent law

**Applies to:** all SKIA repos (`Skia-FULL`, `SKIA-Forge`, `Skia-Status`)  
**Canonical copy:** keep in sync with `Skia-FULL/docs/architecture/SOVEREIGN_PLATFORM.md`  
**Deployment/fallback wiring:** `Skia-FULL/northflank-services.md` (gitignored operator manifest)

SKIA is a **self-built ecosystem**. Product capabilities are integrated in-repo and on Northflank — not rented from third-party SaaS as the default path. When you update code, docs, copy, locale JSON, CSS, or rules, **use what SKIA already ships**. If something is missing, the product direction is to **build it inside SKIA** unless the user explicitly orders a vendor integration.

---

## What SKIA owns (primary — never substitute in agent suggestions)

| Capability | SKIA implementation | Do **not** suggest instead |
|------------|---------------------|----------------------------|
| **UI languages** | 12 locale JSON folders + in-app globe | Browser “Translate page”, Google Translate, DeepL, ChatGPT/Anthropic “translate this JSON” |
| **Typography** | Self-hosted **Agency FB** + **Centaur** (`/fonts/`, `@font-face`) | Google Fonts, Adobe Fonts, CDN fonts, OS fallback stacks |
| **Chat / reasoning** | **Skia-Serve** via `https://api.skia.ca` (Forge consumes; does not host LLM) | OpenAI, Anthropic, or Gemini as **primary** architecture |
| **Image / video** | Sovereign engines on SKIA API (ComfyUI) | Third-party image/video APIs as primary |
| **Voice / TTS** | **tts-service** on SKIA stack | Google Cloud TTS, ElevenLabs, etc. as primary |
| **Forge IDE + hub** | `skia-ide/`, `public/`, `forge.skia.ca` | External IDE or duplicate auth/marketing |

---

## Continuity fallback only (operator/runtime — not Forge customer copy)

When **Skia-Serve, image-engine, or video-engine** are unreachable, the **Skia-FULL** runtime may use **Google Gemini** for continuity only (`ProviderFallbackService`, `SovereignFallbackRouter`). See Skia-FULL `docs/architecture/provider-fallback-truth-table.md` and `docs/ENV_REFERENCE.md` (operator).

**Forge agents:** do not document Gemini as Forge’s brain. Forge routes AI through `SKIA_FULL_API_URL` → SKIA API → Skia-Serve primary.

---

## Agent prohibitions (non-negotiable)

When making updates, **do not mention or recommend** Google, Gemini, OpenAI, Anthropic, DeepL, Google Translate, Google Fonts, or “use an API for X” **except** operator-only fallback/env documentation in Skia-FULL.

### Forbidden in agent responses and in files you create or edit

- External translation APIs for locale JSON (`FORGE_RULES.md` §6)
- Google Fonts or CDN fonts (`design_bible.md` §1)
- Vendor LLMs as Forge’s default path
- Customer-facing “powered by Google/Gemini/OpenAI” copy

### Required redirects

| User need | Point here |
|-----------|------------|
| Translate Forge UI | `FORGE_RULES.md` §6 — JSON locales + `npm run locales:sync` |
| Brand fonts | `design_bible.md` §1 + `npm run fonts:check` |
| Forge AI / agent | `SKIA_FULL_API_URL` → SKIA API — not a new vendor |

---

## Verification

```bash
npm run fonts:check
npm run locales:sync   # when locales changed
```

Cross-repo: update this file and `Skia-FULL/docs/architecture/SOVEREIGN_PLATFORM.md` together.
