import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import { createAgentStore } from "@phoenix/store/agentStore";

describe("handleAgentToolCall", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-agent");
  });

  it("does not dispatch server-executed tools through the frontend registry", async () => {
    const agentStore = createAgentStore();
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleAgentToolCall({
      toolCall: {
        toolCallId: "tool-call-1",
        toolName: "search_phoenix",
        input: { query: "traces" },
      },
      sessionId: "session-1",
      addToolOutput,
      agentStore,
    });

    expect(addToolOutput).not.toHaveBeenCalled();
  });
});
