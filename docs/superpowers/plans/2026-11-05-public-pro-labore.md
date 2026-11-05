# Public Pro-Labore Calculator Implementation Plan

**Goal:** Public Young Contabil calculator at /calculadora-pro-labore without login or data persistence.
**Architecture:** Isolated public React route; pure versioned 2026 calculation module; client PDF via existing pdf-lib. No private API or database changes. Existing protected routes unchanged.
**Approved design:** Activity tab and remuneration tab. Activity determines Simples annex, first band only (RBT12 up to BRL 180,000). Show gross, individual INSS/IRRF/net, company DAS/CPP, minimum revenue, combined taxes without double-counting.

## Scope And Assumptions
- One resident individual, one payer, ordinary domestic revenues in a single activity, established company (13+ months).
- Curated activity categories, not an authoritative full CNAE classifier. Unknown or special regimes block company totals rather than guessing.
- Factor R uses historical payroll including applicable charges and historical RBT12, never the newly simulated pro-labore. No automatic III for all services.
- INSS 11% capped at 2026 ceiling; IRRF monthly progressive table and 2026 reduction, best of legal and simplified deductions (not both). No small DARF exemption inferred.
- Company minimum revenue = (gross + external CPP)/(1 - DAS rate), rounded upward to cents with cash coverage check. Individual withholding already included in gross.
- Anexo IV CPP 20% uncapped, outside DAS. No special CPRB, fixed ISS, monophase/ST, exports, multiple activities or first-year annualization.
- Below minimum contribution and projected annual revenue beyond first band receive warnings; actual historical revenue above limit blocks calculations.
- Logo is local static brand asset. Inputs remain in memory only. PDF contains assumptions, parameters, source links and all results.

## Tasks
- [x] Write failing unit tests: annex rates; factor R threshold/zero/missing inputs; INSS cap; IRRF reduction; legal versus simplified; cash reconciliation; unsafe inputs; out-of-band guard.
- [x] Implement isolated data and pure calculator module.
- [x] Implement accessible responsive public UI and PDF; retain authentication around every existing private page.
- [x] Verify unauthenticated and expired-token entry, form tabs, invalidation, activity/CNAE search, mobile overflow, PDF text and real download in Playwright; visually inspect both PDF pages.
- [x] Review scoped diff, run all 80 tests and production build. Review fixes: exact-cent factor R comparison; case-insensitive public session boundary.

Publication: push scoped changes to main, then verify /calculadora-pro-labore on production with the same browser flow (all calculations are local, no business-data writes).

## Official Sources (checked 2026-11-05)
- https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
- https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
- https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278 (art.25/26)
- https://www2.camara.leg.br/legin/fed/leicom/2016/leicomplementar-155-27-outubro-2016-783850-anexo-pl.pdf
- https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cobrancas-e-intimacoes/contribuicao-previdenciaria-anexo-iv-do-simples-nacional
