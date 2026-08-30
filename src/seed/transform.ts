import { createHash } from "node:crypto";
import type {
  AiAgentInteraction,
  AiAgentInteractionMessage,
  AiAgentInteractionStep,
  CoveMessage,
  CoveRow,
  KeelSessionRecord,
} from "../domain/agentforce.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function assertCoveRow(value: unknown): asserts value is CoveRow {
  if (!isRecord(value) || typeof value.data_source !== "string" || !value.data_source.trim()) {
    throw new Error("CoVe row is missing data_source");
  }
  if (!Array.isArray(value.messages) || !Array.isArray(value.tools)) {
    throw new Error("CoVe row is missing messages or tools");
  }
  for (const message of value.messages) {
    if (!isRecord(message) || !["system", "user", "assistant", "tool"].includes(String(message.role))) {
      throw new Error("CoVe row contains an invalid message");
    }
  }
}

function sourceId(rowIndex: number, row: CoveRow): string {
  const digest = createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 12);
  return `cove/train/${String(rowIndex).padStart(6, "0")}/${digest}`;
}

function interactionGroups(messages: CoveMessage[]): Array<{ start: number; messages: CoveMessage[] }> {
  const groups: Array<{ start: number; messages: CoveMessage[] }> = [];
  let current: { start: number; messages: CoveMessage[] } | null = null;

  messages.forEach((message, index) => {
    if (message.role === "user") {
      current = { start: index, messages: [message] };
      groups.push(current);
      return;
    }
    if (current && message.role !== "system") {
      current.messages.push(message);
    }
  });
  return groups;
}

function recordedError(output: string | null): string | null {
  if (!output) return null;
  try {
    const parsed: unknown = JSON.parse(output);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
    if (parsed.success === false) return typeof parsed.message === "string" ? parsed.message : "Action returned success=false";
    if (typeof parsed.status === "string" && ["error", "failed", "failure"].includes(parsed.status.toLowerCase())) {
      return typeof parsed.message === "string" ? parsed.message : `Action returned status=${parsed.status}`;
    }
  } catch {
    if (/\b(error|failed|failure)\b/i.test(output)) return output;
  }
  return null;
}

function endType(messages: CoveMessage[]): string | null {
  const last = messages.at(-1);
  return last?.role === "user" && last.content?.includes("###STOP###") ? "USER_ENDED" : null;
}

function generationOutput(message: CoveMessage): string | null {
  if (message.content === null && !message.tool_calls?.length) return null;
  return JSON.stringify({ content: message.content, tool_calls: message.tool_calls });
}

export function coveRowToSession(rowIndex: number, value: unknown): KeelSessionRecord {
  assertCoveRow(value);
  const row = value;
  const sessionId = sourceId(rowIndex, row);
  const userParticipantId = `${sessionId}/participant/user`;
  const agentParticipantId = `${sessionId}/participant/agent`;
  const interactions: AiAgentInteraction[] = [];
  const interactionMessages: AiAgentInteractionMessage[] = [];
  const steps: AiAgentInteractionStep[] = [];
  const groups = interactionGroups(row.messages);

  groups.forEach((group, interactionIndex) => {
    const interactionId = `${sessionId}/interaction/${interactionIndex + 1}`;
    interactions.push({
      Id: interactionId,
      AiAgentSessionId: sessionId,
      AiAgentInteractionType: "Turn",
      PrevInteractionId: interactionIndex === 0 ? null : interactions[interactionIndex - 1]?.Id ?? null,
      StartTimestamp: null,
      EndTimestamp: null,
      TelemetryTraceId: null,
      TopicApiName: row.data_source,
    });

    let messageIndex = 0;
    for (const message of group.messages) {
      if (message.role !== "user" && message.role !== "assistant") continue;
      interactionMessages.push({
        Id: `${interactionId}/message/${++messageIndex}`,
        AiAgentInteractionId: interactionId,
        AiAgentSessionId: sessionId,
        AiAgentSessionParticipantId: message.role === "user" ? userParticipantId : agentParticipantId,
        AiAgentInteractionMessageType: message.role === "user" ? "Input" : "Output",
        AiAgentInteractionMsgContentType: "text/plain",
        ContentText: message.content,
        MessageSentTimestamp: null,
      });
    }

    let previousStepId: string | null = null;
    let stepIndex = 0;
    const addStep = (step: Omit<AiAgentInteractionStep, "Id" | "AiAgentInteractionId" | "PrevStepId">) => {
      const stepId = `${interactionId}/step/${++stepIndex}`;
      steps.push({ Id: stepId, AiAgentInteractionId: interactionId, PrevStepId: previousStepId, ...step });
      previousStepId = stepId;
    };

    const userInput = group.messages.find((message) => message.role === "user")?.content ?? null;
    addStep({
      AiAgentInteractionStepType: "TOPIC_STEP",
      Name: row.data_source,
      InputValueText: userInput,
      OutputValueText: row.data_source,
      ErrorMessageText: null,
      PreStepVariableText: null,
      PostStepVariableText: null,
      StartTimestamp: null,
      EndTimestamp: null,
    });

    for (let localIndex = 0; localIndex < group.messages.length; localIndex += 1) {
      const message = group.messages[localIndex];
      if (!message || message.role !== "assistant") continue;
      const absoluteIndex = group.start + localIndex;
      const history = row.messages.slice(0, absoluteIndex);
      addStep({
        AiAgentInteractionStepType: "LLM_STEP",
        Name: null,
        InputValueText: JSON.stringify({ messages: history, tools: row.tools }),
        OutputValueText: generationOutput(message),
        ErrorMessageText: null,
        PreStepVariableText: null,
        PostStepVariableText: null,
        StartTimestamp: null,
        EndTimestamp: null,
      });

      for (const call of message.tool_calls ?? []) {
        const toolResult = row.messages
          .slice(absoluteIndex + 1)
          .find((candidate) => candidate.role === "tool" && candidate.tool_call_id === call.id);
        const output = toolResult?.content ?? null;
        addStep({
          AiAgentInteractionStepType: "ACTION_STEP",
          Name: call.function.name,
          InputValueText: call.function.arguments,
          OutputValueText: output,
          ErrorMessageText: recordedError(output),
          PreStepVariableText: null,
          PostStepVariableText: null,
          StartTimestamp: null,
          EndTimestamp: null,
        });
      }
    }
  });

  return {
    schemaVersion: "keel.agentforce-session.v1",
    source: { dataset: "Zichen1024/CoVe-12k", config: "default", split: "train", rowIndex },
    AiAgentSession: {
      Id: sessionId,
      StartTimestamp: null,
      EndTimestamp: null,
      AiAgentChannelType: null,
      AiAgentSessionEndType: endType(row.messages),
      VariableText: null,
    },
    AiAgentSessionParticipant: [
      {
        Id: userParticipantId,
        AiAgentSessionId: sessionId,
        AiAgentSessionParticipantRole: "USER",
        AiAgentApiName: null,
        AiAgentVersionApiName: null,
        ParticipantId: null,
        ParticipantObject: null,
        StartTimestamp: null,
        EndTimestamp: null,
      },
      {
        Id: agentParticipantId,
        AiAgentSessionId: sessionId,
        AiAgentSessionParticipantRole: "AGENT",
        AiAgentApiName: row.data_source,
        AiAgentVersionApiName: null,
        ParticipantId: null,
        ParticipantObject: null,
        StartTimestamp: null,
        EndTimestamp: null,
      },
    ],
    AiAgentInteraction: interactions,
    AiAgentInteractionMessage: interactionMessages,
    AiAgentInteractionStep: steps,
  };
}
