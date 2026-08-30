import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { coveRowToSession } from "../src/seed/transform.js";

function loadedRecord(marker: string) {
  return coveRowToSession(841, {
    data_source: marker,
    tools: [{ type: "function", function: { name: `update_${marker}` } }],
    messages: [
      { role: "system", content: "Ask before writes", tool_call_id: null, tool_calls: null },
      { role: "user", content: "Change the record", tool_call_id: null, tool_calls: null },
      { role: "assistant", content: "Please confirm before I proceed.", tool_call_id: null, tool_calls: null },
      { role: "user", content: "Yes, go ahead", tool_call_id: null, tool_calls: null },
      {
        role: "assistant",
        content: null,
        tool_call_id: null,
        tool_calls: [
          {
            id: `call-${marker}`,
            type: "function",
            function: { name: `update_${marker}`, arguments: `{"marker":"${marker}"}` },
          },
        ],
      },
      { role: "tool", content: `{"status":"complete","marker":"${marker}"}`, tool_call_id: `call-${marker}`, tool_calls: null },
    ],
  });
}

describe("three data-driven screens", () => {
  it("renders all and only the contracted screens from loaded session values", async () => {
    const marker = `loaded_${randomUUID().replaceAll("-", "")}`;
    const app = createApp(async () => [loadedRecord(marker)]);

    const audit = await request(app).get("/session-audit");
    const agents = await request(app).get("/org-agents");
    const acting = await request(app).get("/enterprise-acting");
    const extra = await request(app).get("/");

    expect(audit.status).toBe(200);
    expect(audit.text).toContain(marker);
    expect(audit.text).toContain(`update_${marker}`);
    expect(agents.status).toBe(200);
    expect(agents.text).toContain(marker);
    expect(acting.status).toBe(200);
    expect(acting.text).toContain(`update_${marker}`);
    expect(acting.text).toContain("Approval paired");
    expect(extra.status).toBe(404);
  });

  it("fails closed when the MinIO loader fails", async () => {
    const app = createApp(async () => {
      throw new Error("object store unavailable");
    });
    const response = await request(app).get("/session-audit");

    expect(response.status).toBe(503);
    expect(response.text).toContain("Load failed closed");
    expect(response.text).toContain("object store unavailable");
    expect(response.text).toContain("No fixture fallback");
  });
});
