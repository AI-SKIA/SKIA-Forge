# Enterprise Readiness Checklist

## Your guide to evaluating and deploying SKIA Forge at scale

Use this checklist when your organisation is deciding whether SKIA Forge fits your engineering, security, and operations requirements. Each item is written for **you** — the security, platform, or engineering lead reviewing the product.

---

## Product and architecture

- [ ] Your team should confirm the product scope matches your expectations: governance and orchestration for AI-assisted development, aligned with your existing delivery stack.
- [ ] Your team should confirm you have a clear picture of core capabilities (planning, execution safety, architecture insight, and policy-aware automation) from the product manual and public materials.
- [ ] Your team should confirm integration expectations with your existing tools and workflows are documented and agreed internally.
- [ ] Your team should confirm you have access to an up-to-date API reference for any automation or custom clients you plan to run.

## Security and governance

- [ ] Your team should confirm security controls and threat assumptions are documented and acceptable under your policies (`SECURITY_GUIDE.md`).
- [ ] Your team should confirm how governance modes (strict, adaptive, autonomous) map to your risk appetite and who can change them.
- [ ] Your team should confirm high-risk operations, approvals, and audit expectations meet your compliance needs.
- [ ] Your team should confirm secret handling, environment configuration, and access control for Forge hosts match your standards.

## Operations

- [ ] Your team should confirm you have an operational runbook for deployment, upgrades, and rollback (`OPERATOR_MANUAL.md`).
- [ ] Your team should confirm health and readiness checks you rely on are defined and monitored in your environment.
- [ ] Your team should confirm troubleshooting and escalation paths are understood (`SUPPORT.md`, `TROUBLESHOOTING.md`).
- [ ] Your team should confirm backup, recovery, and incident response procedures for Forge-managed assets are assigned.

## Quality and reliability

- [ ] Your team should confirm release quality expectations (testing, change management) align with your internal gates.
- [ ] Your team should confirm known limitations and non-goals are captured so stakeholders share the same assumptions.
- [ ] Your team should confirm performance and availability targets for your deployment topology are documented.

## Commercial and support

- [ ] Your team should confirm packaging and licensing match the seats or deployment model you intend to purchase (`PRICING_AND_PACKAGES.md`).
- [ ] Your team should confirm support tiers, response expectations, and escalation contacts are agreed with SKIA.
- [ ] Your team should confirm procurement items (security questionnaires, DPA, subprocessors if applicable) are tracked to completion before go-live.
