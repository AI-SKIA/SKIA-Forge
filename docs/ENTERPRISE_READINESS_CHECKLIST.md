# Enterprise Readiness Checklist

Use this checklist before enterprise pilots and procurement conversations.

## Ecosystem boundary check

- [ ] Forge scope is documented as control-plane (not product runtime replacement)
- [ ] Dependencies on `Skia-FULL` runtime contracts are documented
- [ ] Public incident/status process with `Skia-Status` is documented

## Product and Architecture

- [ ] Clear product definition and scope (`PRODUCT_MANUAL.md`)
- [ ] Architecture and integration surfaces documented
- [ ] API reference available and up to date

## Security and Governance

- [ ] Security controls documented (`SECURITY_GUIDE.md`)
- [ ] Governance modes and policy behavior validated
- [ ] High-risk operation handling tested
- [ ] Secret handling and environment guidance documented

## Operations

- [ ] Operator runbook complete (`OPERATOR_MANUAL.md`)
- [ ] Health and probe endpoints validated
- [ ] Troubleshooting paths documented
- [ ] Rollback and remediation process defined

## Quality and Reliability

- [ ] Build passes
- [ ] Test suite passes
- [ ] Integration probes pass in target environment
- [ ] Known limitations explicitly documented

## Commercial and Support

- [ ] Package definitions published (`PRICING_AND_PACKAGES.md`)
- [ ] Support model documented (`SUPPORT.md`)
- [ ] Enterprise escalation path and SLA expectations defined

## Sales Enablement

- [ ] Investor, developer, and enterprise sales guides prepared
- [ ] Demo storyline and success criteria defined
- [ ] Pilot plan with measurable outcomes ready

## Go / No-Go

- [ ] Go: all mandatory items complete
- [ ] No-Go: open critical gaps tracked with owners and target dates
