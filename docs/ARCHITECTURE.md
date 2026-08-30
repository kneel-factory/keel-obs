# Keel architecture

## Components

Keel is deliberately small: a TypeScript seeder, MinIO, a typed TypeScript loader, and one server-rendered web process. `make seed` calls the Hugging Face Dataset Server for a small stratified slice of `Zichen1024/CoVe-12k`, maps each real trajectory into the Agentforce session grammar, and writes one immutable JSON object per session plus a manifest through the S3 API. The web process reads that manifest and every referenced session object from MinIO for each request, derives read-only summaries, and renders one of three routes.

The browser never owns golden data. It receives HTML made from the same loaded `KeelSessionRecord[]` used by all three screens. There are no embedded session rows, agent identities, tool calls, enterprise actions, or trajectory fixtures in application code.

## Data flow

```text
Hugging Face CoVe-12k Dataset Server
  -> seed fetch + source validation
  -> Agentforce grammar mapping (one row = one session)
  -> S3 PutObject
  -> MinIO: sessions/*.json + manifest.json
  -> typed S3 loader (all-or-error)
  -> shared session records
  -> session audit | organization agents | enterprise acting
```

If Hugging Face is unavailable, seeding fails without writing a replacement fixture. If MinIO, the manifest, or a session object is unavailable or malformed, the loader throws and the requested screen returns a visible `503` error state. Partial session sets and fixture fallbacks are intentionally rejected.

## Session grammar

The storage envelope uses the public Agentforce/Data Cloud object names and field names:

- `AiAgentSession` is the trajectory container.
- `AiAgentSessionParticipant` has a `USER` participant and an `AGENT` participant. `AiAgentApiName` comes from the row’s `data_source`; unavailable version and identity fields remain null.
- `AiAgentInteraction` is one user turn plus the agent/tool activity before the next user turn.
- `AiAgentInteractionMessage` stores user input and agent output text. Tool results live on action steps rather than being mislabeled as participant messages.
- `AiAgentInteractionStep` contains one `TOPIC_STEP` for routing, one `LLM_STEP` for each assistant generation or tool-call decision, and one `ACTION_STEP` for each tool invocation. `PrevStepId` preserves exact step order. Inputs, outputs, and errors are copied or conservatively derived from the source trajectory.
- `AiAgentMoment` and tags are omitted because CoVe-12k rows do not provide those objects.

CoVe-12k has no trustworthy event timestamps, model/version, tokens, monetary cost, or latency. Those fields remain empty and the UI says “Not recorded.” IDs use a transparent `cove/<split>/<row>/<content-hash>` namespace, not Salesforce-shaped identifiers.

## Why three screens

The three views answer three different audit questions against one record model. Session audit explains one trajectory end to end. Organization agents establishes what agent identities are present and how much they act. Enterprise acting shows the consequential behavior—tools, writes, approvals, handoffs, policy boundaries, and outcomes—across sessions. Keeping these questions separate avoids turning a forensic timeline into an inventory table or an enterprise behavior view into a generic metrics wall. The locked contracts in `screens/` are the complete product boundary.

## Why MinIO

MinIO gives local development the same S3 API boundary used by production object storage without introducing a database or allowing UI fixtures to become a second source of truth. It makes provenance visible, keeps the golden trajectories immutable and inspectable, and lets the loader fail exactly as it would against an unavailable or malformed object store. The app is storage-agnostic at the S3 client boundary, but MinIO is the required local mock.

## Why CoVe-12k is the golden set

The [CoVe-12k dataset card](https://huggingface.co/datasets/Zichen1024/CoVe-12k) describes 12,000 multi-turn interactive tool-use trajectories created with constraint-guided verification. Those are sessions, not classification labels: every row contains `messages`, `data_source`, and `tools`. That shape exercises turns, model decisions, exact tool arguments, tool results, write actions, explicit confirmation, handoffs, and policy behavior—precisely the evidence an enterprise audit product must preserve.

The observability model also reflects the useful common core found in the studied projects: trace/session identity, ordered parented spans, typed LLM/tool observations, exact input/output, errors, usage/cost/latency when present, annotations/evaluations, and rule detections. Keel retains that evidence model but does not copy any reference UI. Salesforce’s public [session tracing model](https://help.salesforce.com/s/articleView?id=ai.generative_ai_session_trace_data_model.htm&type=5) and [Data 360 DMO mapping guide](https://developer.salesforce.com/docs/data/data-cloud-dmo-mapping/guide/c360dm-si-aiagentinteractionstepdmo-dmo.html) anchor the object and field vocabulary.
