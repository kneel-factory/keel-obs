# Enterprise acting

Status: locked. This is a read-only behavior screen at `/enterprise-acting`.

## Feature list

- A shared Keel shell with links to the three contracted screens and an explicit “CoVe-12k · MinIO” evidence source indicator.
- An enterprise behavior summary derived from loaded `ACTION_STEP` records, interaction messages, and recorded outcomes—not generic infrastructure metrics.
- A tool register ranked by observed fire count, with source-backed tool name, acting agent, system/domain, read-versus-write posture, completion count, failure count, and unknown-outcome count.
- A system-write ledger for actions whose observed tool names express mutating operations. Each entry carries the source session, exact action input, and recorded result.
- A handoff ledger for observed transfer, handoff, or escalation actions, including the source session and outcome.
- A human-in-the-loop ledger that pairs an observed confirmation request and affirmative user response with the later write it authorized. Unproven approvals are not counted.
- A policy stop and gate ledger grounded in observed agent text such as refusal, permission boundaries, or explicit-confirmation requirements.
- Outcome accounting based only on action result/error evidence: completed, failed, or not recorded.
- Direct links from behavior evidence to the corresponding session on the session-audit route.
- A fail-closed error or empty state on this route when MinIO, the manifest, or a session object fails to load. There is no fixture fallback.

## Explicitly excluded

- A Grafana-style infrastructure dashboard, workflow mutation, approval execution, alert configuration, invented CRM writes, and screens outside the three contracted routes.
