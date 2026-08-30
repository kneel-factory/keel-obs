# Session audit

Status: locked. This is a read-only audit screen at `/session-audit`.

## Feature list

- A shared Keel shell with links to the three contracted screens and an explicit “CoVe-12k · MinIO” evidence source indicator.
- A session picker on the same route. The selected record is always one of the sessions returned by the MinIO loader.
- A session identity header showing the source-backed session ID, agent identity, participant roles, source row, end type, channel, and time window. Unavailable source fields say “Not recorded.”
- An evidence summary for interaction, message, LLM-step, action-step, and topic-step counts. Evaluations, cost, token usage, and latency remain visibly unrecorded because CoVe-12k does not contain them.
- A participant roster mapped to `AiAgentSessionParticipant`, including `USER` and `AGENT` roles without fabricated user or Salesforce IDs.
- A complete, ordered timeline grouped by `AiAgentInteraction` turn. Every available `AiAgentInteractionMessage` appears in its turn.
- Every `TOPIC_STEP`, `LLM_STEP`, and `ACTION_STEP` appears in source order with its name, exact input, exact output, error text, and previous-step linkage. Empty source fields remain empty.
- Tool outcomes are derived from the recorded result: completed, failed, or not recorded. No success is fabricated when a result is absent.
- Evidence-backed detections for system writes, explicit-confirmation gates, handoffs, and policy stops. Each detection links its claim to text or a step in the loaded trajectory.
- A replay manifest that exposes dataset/split/row provenance, content-derived integrity ID, ordered interaction count, and whether action inputs/results are complete. It makes the audit replayable without firing enterprise actions from this read-only product.
- A fail-closed error or empty state on this route when MinIO, the manifest, or any selected session fails to load. There is no fixture fallback.

## Explicitly excluded

- Prompt editing, a playground, live replay execution, trace mutation, invented timings, invented model metadata, and screens outside the three contracted routes.
