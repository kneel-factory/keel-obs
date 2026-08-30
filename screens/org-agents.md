# Organization agents

Status: locked. This is a read-only inventory screen at `/org-agents`.

## Feature list

- A shared Keel shell with links to the three contracted screens and an explicit “CoVe-12k · MinIO” evidence source indicator.
- An organization-level inventory derived from `AGENT` participants across all loaded `AiAgentSession` records.
- One row per source-backed agent identity with API identity, version, channel, owner, last seen, session volume, interaction volume, message volume, and action volume.
- Missing version, channel, owner, and last-seen values say “Not recorded” or “Unassigned”; Keel does not manufacture organization metadata that CoVe-12k lacks.
- A compact organization scope summary showing loaded agent, session, turn, and action totals.
- Per-agent action posture showing the number of distinct tools used, system writes, handoffs, and policy gates derived from that agent’s loaded sessions.
- Volume bars compare loaded session volume without implying production traffic beyond the seeded golden slice.
- A fail-closed error or empty state on this route when MinIO, the manifest, or a session object fails to load. There is no fixture fallback.

## Explicitly excluded

- Prompt editing, model configuration, agent creation, a prompt playground, fabricated owners or versions, and screens outside the three contracted routes.
