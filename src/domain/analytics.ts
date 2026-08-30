import type {
  AiAgentInteractionMessage,
  AiAgentInteractionStep,
  KeelSessionRecord,
} from "./agentforce.js";

export type ActionOutcome = "completed" | "failed" | "not-recorded";
export type ActionPosture = "read" | "write";

export interface ActionEvidence {
  record: KeelSessionRecord;
  step: AiAgentInteractionStep;
  agent: string | null;
  system: string | null;
  outcome: ActionOutcome;
  posture: ActionPosture;
  handoff: boolean;
}

export interface ApprovalEvidence {
  action: ActionEvidence;
  request: AiAgentInteractionMessage;
  approval: AiAgentInteractionMessage;
}

export interface PolicyEvidence {
  record: KeelSessionRecord;
  message: AiAgentInteractionMessage;
  kind: "confirmation-gate" | "policy-stop";
}

export interface EnterpriseEvidence {
  actions: ActionEvidence[];
  writes: ActionEvidence[];
  handoffs: ActionEvidence[];
  approvals: ApprovalEvidence[];
  policies: PolicyEvidence[];
}

export interface AgentSummary {
  identity: string;
  version: string | null;
  channels: string[];
  lastSeen: string | null;
  sessions: number;
  interactions: number;
  messages: number;
  actions: number;
  distinctTools: number;
  writes: number;
  handoffs: number;
  policyGates: number;
}

const writeVerb = /^(add|book|cancel|create|delete|edit|exchange|issue|modify|refund|remove|send|set|submit|update|write)(_|$)/i;
const handoffVerb = /(transfer|handoff|hand_off|escalat)/i;
const confirmationRequest = /\b(confirm|confirmation|approval|approve|permission|before (?:i|we) (?:can )?(?:proceed|continue)|would you like (?:me )?to proceed|shall (?:i|we) proceed)\b/i;
const affirmative = /\b(yes|confirmed|confirm|approved|approve|go ahead|proceed|please do|do it)\b/i;
const policyStop = /\b(cannot|can't|unable to|not (?:allowed|permitted)|must not|won't be able|outside (?:the|my) policy)\b/i;

export function humanize(value: string | null): string {
  if (!value) return "Not recorded";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function actionOutcome(step: AiAgentInteractionStep): ActionOutcome {
  if (step.ErrorMessageText) return "failed";
  if (step.OutputValueText === null || step.OutputValueText === "") return "not-recorded";
  return "completed";
}

export function actionPosture(name: string | null): ActionPosture {
  return name && writeVerb.test(name) ? "write" : "read";
}

function agentIdentity(record: KeelSessionRecord): string | null {
  return record.AiAgentSessionParticipant.find(
    (participant) => participant.AiAgentSessionParticipantRole === "AGENT",
  )?.AiAgentApiName ?? null;
}

function interactionNumber(id: string): number {
  const match = id.match(/\/interaction\/(\d+)/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
}

function orderedMessages(record: KeelSessionRecord): AiAgentInteractionMessage[] {
  return [...record.AiAgentInteractionMessage].sort((left, right) => {
    const interactionOrder = interactionNumber(left.AiAgentInteractionId) - interactionNumber(right.AiAgentInteractionId);
    if (interactionOrder !== 0) return interactionOrder;
    return left.Id.localeCompare(right.Id, undefined, { numeric: true });
  });
}

function approvalFor(action: ActionEvidence): ApprovalEvidence | null {
  if (action.posture !== "write") return null;
  const messages = orderedMessages(action.record);
  const actionTurn = interactionNumber(action.step.AiAgentInteractionId);
  const candidates = messages.filter((message) => interactionNumber(message.AiAgentInteractionId) <= actionTurn);
  let request: AiAgentInteractionMessage | null = null;
  let approval: AiAgentInteractionMessage | null = null;

  for (const message of candidates) {
    if (message.AiAgentInteractionMessageType === "Output" && confirmationRequest.test(message.ContentText ?? "")) {
      request = message;
      approval = null;
      continue;
    }
    if (request && message.AiAgentInteractionMessageType === "Input" && affirmative.test(message.ContentText ?? "")) {
      approval = message;
    }
  }
  return request && approval ? { action, request, approval } : null;
}

export function enterpriseEvidence(records: KeelSessionRecord[]): EnterpriseEvidence {
  const actions: ActionEvidence[] = records.flatMap((record) => {
    const agent = agentIdentity(record);
    return record.AiAgentInteractionStep
      .filter((step) => step.AiAgentInteractionStepType === "ACTION_STEP")
      .map((step) => ({
        record,
        step,
        agent,
        system: record.AiAgentInteraction.find((interaction) => interaction.Id === step.AiAgentInteractionId)?.TopicApiName ?? null,
        outcome: actionOutcome(step),
        posture: actionPosture(step.Name),
        handoff: handoffVerb.test(step.Name ?? ""),
      }));
  });
  const approvals = actions.map(approvalFor).filter((value): value is ApprovalEvidence => value !== null);
  const policies: PolicyEvidence[] = records.flatMap((record) =>
    record.AiAgentInteractionMessage.flatMap<PolicyEvidence>((message) => {
      if (message.AiAgentInteractionMessageType !== "Output" || !message.ContentText) return [];
      if (policyStop.test(message.ContentText)) return [{ record, message, kind: "policy-stop" as const }];
      if (confirmationRequest.test(message.ContentText)) return [{ record, message, kind: "confirmation-gate" as const }];
      return [];
    }),
  );
  return {
    actions,
    writes: actions.filter((action) => action.posture === "write"),
    handoffs: actions.filter((action) => action.handoff),
    approvals,
    policies,
  };
}

export function agentSummaries(records: KeelSessionRecord[]): AgentSummary[] {
  const identities = new Set(
    records.flatMap((record) =>
      record.AiAgentSessionParticipant
        .filter((participant) => participant.AiAgentSessionParticipantRole === "AGENT" && participant.AiAgentApiName)
        .map((participant) => participant.AiAgentApiName as string),
    ),
  );
  const evidence = enterpriseEvidence(records);
  return [...identities]
    .map((identity) => {
      const agentRecords = records.filter((record) => agentIdentity(record) === identity);
      const actions = evidence.actions.filter((action) => action.agent === identity);
      const versions = agentRecords
        .flatMap((record) => record.AiAgentSessionParticipant)
        .filter((participant) => participant.AiAgentApiName === identity)
        .map((participant) => participant.AiAgentVersionApiName)
        .filter((version): version is string => Boolean(version));
      const channels = agentRecords
        .map((record) => record.AiAgentSession.AiAgentChannelType)
        .filter((channel): channel is string => Boolean(channel));
      const timestamps = agentRecords
        .flatMap((record) => [record.AiAgentSession.EndTimestamp, record.AiAgentSession.StartTimestamp])
        .filter((timestamp): timestamp is string => Boolean(timestamp))
        .sort();
      return {
        identity,
        version: versions[0] ?? null,
        channels: [...new Set(channels)],
        lastSeen: timestamps.at(-1) ?? null,
        sessions: agentRecords.length,
        interactions: agentRecords.reduce((sum, record) => sum + record.AiAgentInteraction.length, 0),
        messages: agentRecords.reduce((sum, record) => sum + record.AiAgentInteractionMessage.length, 0),
        actions: actions.length,
        distinctTools: new Set(actions.map((action) => action.step.Name).filter(Boolean)).size,
        writes: actions.filter((action) => action.posture === "write").length,
        handoffs: actions.filter((action) => action.handoff).length,
        policyGates: evidence.policies.filter((policy) => agentIdentity(policy.record) === identity).length,
      };
    })
    .sort((left, right) => right.sessions - left.sessions || left.identity.localeCompare(right.identity));
}
