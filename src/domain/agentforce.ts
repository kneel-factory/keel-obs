export type ParticipantRole = "USER" | "AGENT";
export type InteractionMessageType = "Input" | "Output";
export type InteractionStepType = "LLM_STEP" | "ACTION_STEP" | "TOPIC_STEP";

export interface AiAgentSession {
  Id: string;
  StartTimestamp: string | null;
  EndTimestamp: string | null;
  AiAgentChannelType: string | null;
  AiAgentSessionEndType: string | null;
  VariableText: string | null;
}

export interface AiAgentSessionParticipant {
  Id: string;
  AiAgentSessionId: string;
  AiAgentSessionParticipantRole: ParticipantRole;
  AiAgentApiName: string | null;
  AiAgentVersionApiName: string | null;
  ParticipantId: string | null;
  ParticipantObject: string | null;
  StartTimestamp: string | null;
  EndTimestamp: string | null;
}

export interface AiAgentInteraction {
  Id: string;
  AiAgentSessionId: string;
  AiAgentInteractionType: "Turn";
  PrevInteractionId: string | null;
  StartTimestamp: string | null;
  EndTimestamp: string | null;
  TelemetryTraceId: string | null;
  TopicApiName: string | null;
}

export interface AiAgentInteractionMessage {
  Id: string;
  AiAgentInteractionId: string;
  AiAgentSessionId: string;
  AiAgentSessionParticipantId: string;
  AiAgentInteractionMessageType: InteractionMessageType;
  AiAgentInteractionMsgContentType: "text/plain";
  ContentText: string | null;
  MessageSentTimestamp: string | null;
}

export interface AiAgentInteractionStep {
  Id: string;
  AiAgentInteractionId: string;
  PrevStepId: string | null;
  AiAgentInteractionStepType: InteractionStepType;
  Name: string | null;
  InputValueText: string | null;
  OutputValueText: string | null;
  ErrorMessageText: string | null;
  PreStepVariableText: string | null;
  PostStepVariableText: string | null;
  StartTimestamp: string | null;
  EndTimestamp: string | null;
}

export interface KeelSessionRecord {
  schemaVersion: "keel.agentforce-session.v1";
  source: {
    dataset: "Zichen1024/CoVe-12k";
    config: "default";
    split: "train";
    rowIndex: number;
  };
  AiAgentSession: AiAgentSession;
  AiAgentSessionParticipant: AiAgentSessionParticipant[];
  AiAgentInteraction: AiAgentInteraction[];
  AiAgentInteractionMessage: AiAgentInteractionMessage[];
  AiAgentInteractionStep: AiAgentInteractionStep[];
}

export interface CoveToolCall {
  id: string | null;
  type: string | null;
  function: {
    name: string;
    arguments: string | null;
  };
}

export interface CoveMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id: string | null;
  tool_calls: CoveToolCall[] | null;
}

export interface CoveTool {
  type?: string;
  function?: {
    name?: string;
    description?: string;
    parameters?: unknown;
  };
}

export interface CoveRow {
  messages: CoveMessage[];
  data_source: string;
  tools: CoveTool[];
}

export function assertKeelSessionRecord(value: unknown): asserts value is KeelSessionRecord {
  if (!value || typeof value !== "object") {
    throw new Error("Session object is not an object");
  }

  const record = value as Partial<KeelSessionRecord>;
  if (
    record.schemaVersion !== "keel.agentforce-session.v1" ||
    !record.source ||
    record.source.dataset !== "Zichen1024/CoVe-12k" ||
    !record.AiAgentSession ||
    typeof record.AiAgentSession.Id !== "string" ||
    !Array.isArray(record.AiAgentSessionParticipant) ||
    !Array.isArray(record.AiAgentInteraction) ||
    !Array.isArray(record.AiAgentInteractionMessage) ||
    !Array.isArray(record.AiAgentInteractionStep)
  ) {
    throw new Error("Session object does not match the Keel Agentforce grammar");
  }

  const stepTypes = new Set<InteractionStepType>(["LLM_STEP", "ACTION_STEP", "TOPIC_STEP"]);
  for (const step of record.AiAgentInteractionStep) {
    if (!step || typeof step.Id !== "string" || !stepTypes.has(step.AiAgentInteractionStepType)) {
      throw new Error("Session object contains an invalid interaction step");
    }
  }

  const participantRoles = new Set<ParticipantRole>(["USER", "AGENT"]);
  for (const participant of record.AiAgentSessionParticipant) {
    if (!participant || !participantRoles.has(participant.AiAgentSessionParticipantRole)) {
      throw new Error("Session object contains an invalid participant role");
    }
  }
}
