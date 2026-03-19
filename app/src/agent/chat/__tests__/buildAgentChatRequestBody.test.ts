import { buildAgentChatRequestBody } from "@phoenix/agent/chat/buildAgentChatRequestBody";

describe("buildAgentChatRequestBody", () => {
  it("includes the agent system prompt and bash tool definition", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [],
      trigger: "submit-message",
      messageId: undefined,
    });

    expect(body.system).toContain("sandbox constraints");
    expect(body.system).toContain("/phoenix/agent-start.md");
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0]?.name).toBe("bash");
    expect(body.tools[0]?.description).toContain("browser-only");
    expect(body.tools[0]?.description).toContain("/phoenix");
  });
});
