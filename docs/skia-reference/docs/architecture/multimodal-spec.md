# Multimodal capability — v1 spec (Phase 0.3)

## Supported input types (v1)

- **PDF** (text extraction; scanned PDFs without OCR may return limited text).
- **Image** (PNG, JPEG, WEBP) where wired by feature routes and provider config.
- **Code + free-text context** as inline strings (e.g. “codebase context” for analysis).

**Optional (roadmap):** audio, video; not part of the v1 contract in this file.

## Max sizes (v1)

| Input | Limit |
|-------|--------|
| PDF | **≤ 10MB** per upload (enforced in login route) |
| Image | **≤ 5MB** per image |
| Images per request | **≤ 10** (when multi-image is enabled for a route) |
| `codeContext` (string) | Truncated server-side (large caps in handler; do not send megabytes) |

## Routing path (invariant)

**Browser** → `https://skia.ca/api/...` (Next.js) → **login service** (`api.skia.ca` / in-cluster `login:3001`) → **in-process** analysis or internal orchestration. **No** `backend:4000` surface in the browser path.

In this repository, the **PDF + code context** first live path is: `POST /api/multimodal/analyze` (multipart, field `pdf` + `codeContext`), with **user session** required (`userAuth`).

## API contract

- **Path:** `POST /api/multimodal/analyze`
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `pdf` (file, required) — one PDF
  - `codeContext` (string, optional) — repo or module summary, snippets, or notes
- **200 JSON (success):**
  ```json
  {
    "success": true,
    "analysis": { "summary": "...", "keyFindings": [], "codeAlignment": "...", "risks": [] },
    "meta": { "pdfTextChars": 0, "codeContextChars": 0 }
  }
  ```
  If the model returns non-JSON, a fallback object with `raw` and `parseError: true` may be returned.
- **Errors:** `400` (missing/invalid), `500` (handler failure; message redacted in production as appropriate)

---

**Skia production alignment (2026).** Same-origin `/api/...` from the app → **login service** in production. Routing: `docs/architecture/skia-routing-invariants.md`. Map of docs: `docs/DOCUMENTATION_MAP.md`. Infra (private): `northflank-services.md`. Feature wiring: `exports/PRE_PUSH_FEATURE_AUDIT.md`. Env names: `.env.example`.

<!-- skia-doc-stamp:v1 -->
