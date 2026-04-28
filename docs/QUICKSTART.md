# SKIA-Forge Quickstart (5 Minutes)

## Scope

Bootstrap Forge control-plane runtime. For customer feature runtime setup use `Skia-FULL`; for public status deployment use `Skia-Status`.

## 1) Install dependencies

```bash
npm install
```

## 2) Start Forge

```bash
npm run dev
```

## 3) Validate health

- Open health endpoints:
  - `/health`
  - `/integration/skia-full`
  - `/integration/skia-full/probe`

## 4) Validate quality gates

```bash
npm run build
npm run test
```

## 5) First productive workflow

1. Send a request to a Forge orchestration surface.
2. Review stage decisions and governance output.
3. Apply remediation if blocked.
4. Re-run to healthy posture.

## Need more?

- Product overview: `PRODUCT_MANUAL.md`
- API list: `API_REFERENCE.md`
- Ops: `OPERATOR_MANUAL.md`
- Troubleshooting: `TROUBLESHOOTING.md`
