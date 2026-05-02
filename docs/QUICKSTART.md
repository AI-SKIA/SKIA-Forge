# SKIA-Forge Quickstart (5 Minutes)

## Scope

Bootstrap the Forge **control-plane** Node server. Customer-facing product setup lives in `Skia-FULL`; public status deployment in `Skia-Status`.

## 1) Install dependencies

```bash
npm install
```

## 2) Start Forge

```bash
npm run dev
```

Default bind: **`SKIA_PORT`** (default **4173**).

## 3) Validate health

Open or curl:

- `GET /health` — basic OK
- `GET /live` — liveness
- `GET /ready` — readiness (`503` if not ready)
- `GET /integration/skia-full` — adapter status
- `GET /integration/skia-full/probe` — contract probe

## 4) Validate quality gates

```bash
npm run build
npm run test
```

## 5) First productive workflow

1. Send a request to a Forge orchestration surface (e.g. `POST /api/forge/orchestrate` or module endpoints — see `API_REFERENCE.md`).
2. Review stage decisions and governance output.
3. Apply remediation if blocked.
4. Re-run to healthy posture.

## Optional: desktop IDE

1. Build the Electron renderer: `cd skia-ide && npm install && npm run build`.
2. Open `GET /forge/app` in the browser *or* run `npm start` in `skia-ide` for the desktop shell.
3. Sign in or register **inside the IDE** when prompted — the canonical download page (`https://skia.ca/platform-downloads`) does not carry account CTAs.

## Need more?

- Product overview: `PRODUCT_MANUAL.md`
- API list: `API_REFERENCE.md`
- Ops: `OPERATOR_MANUAL.md`
- Troubleshooting: `TROUBLESHOOTING.md`
