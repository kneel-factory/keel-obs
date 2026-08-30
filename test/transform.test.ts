import { describe, expect, it } from "vitest";
import { coveRowToSession } from "../src/seed/transform.js";

describe("CoVe trajectory mapping", () => {
  it("maps one trajectory to the Agentforce session grammar without invented telemetry", () => {
    const record = coveRowToSession(37, {
      data_source: "source-from-row",
      tools: [{ type: "function", function: { name: "update_from_row" } }],
      messages: [
        { role: "system", content: "Policy from source", tool_call_id: null, tool_calls: null },
        { role: "user", content: "Please update it", tool_call_id: null, tool_calls: null },
        {
          role: "assistant",
          content: null,
          tool_call_id: null,
          tool_calls: [
            {
              id: "call-from-row",
              type: "function",
              function: { name: "update_from_row", arguments: "{\"value\":1}" },
            },
          ],
        },
        { role: "tool", content: "{\"success\":true}", tool_call_id: "call-from-row", tool_calls: null },
        { role: "assistant", content: "Updated", tool_call_id: null, tool_calls: null },
        { role: "user", content: "Thanks ###STOP###", tool_call_id: null, tool_calls: null },
      ],
    });

    expect(record.AiAgentSession.Id).toMatch(/^cove\/train\/000037\/[a-f0-9]{12}$/);
    expect(record.AiAgentSession.StartTimestamp).toBeNull();
    expect(record.AiAgentSession.AiAgentSessionEndType).toBe("USER_ENDED");
    expect(record.AiAgentSessionParticipant.map((participant) => participant.AiAgentSessionParticipantRole)).toEqual([
      "USER",
      "AGENT",
    ]);
    expect(record.AiAgentSessionParticipant[1]?.AiAgentApiName).toBe("source-from-row");
    expect(record.AiAgentInteraction).toHaveLength(2);
    expect(record.AiAgentInteractionStep.map((step) => step.AiAgentInteractionStepType)).toEqual([
      "TOPIC_STEP",
      "LLM_STEP",
      "ACTION_STEP",
      "LLM_STEP",
      "TOPIC_STEP",
    ]);
    const action = record.AiAgentInteractionStep.find((step) => step.AiAgentInteractionStepType === "ACTION_STEP");
    expect(action).toMatchObject({
      Name: "update_from_row",
      InputValueText: "{\"value\":1}",
      OutputValueText: "{\"success\":true}",
      ErrorMessageText: null,
    });
    const generation = record.AiAgentInteractionStep.find(
      (step) => step.AiAgentInteractionStepType === "LLM_STEP",
    );
    expect(generation?.InputValueText).toContain("update_from_row");
    expect(generation?.InputValueText).toContain("Policy from source");
    expect(record).not.toHaveProperty("AiAgentMoment");
  });
});
