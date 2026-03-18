import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import { clearBashToolRuntime } from "@phoenix/agent/tools/bash/bashToolSessionRegistry";

describe("handleAgentToolCall", () => {
  afterEach(() => {
    clearBashToolRuntime("session-1");
  });

  it("executes the bash tool and returns instrumented output", async () => {
    const addToolOutput = vi.fn().mockResolvedValue(undefined);

    await handleAgentToolCall({
      toolCall: {
        toolCallId: "call-1",
        toolName: "bash",
        input: {
          command: "printf 'hello world'",
        },
      },
      sessionId: "session-1",
      addToolOutput,
    });

    expect(addToolOutput).toHaveBeenCalledTimes(1);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "bash",
        toolCallId: "call-1",
        output: expect.objectContaining({
          command: "printf 'hello world'",
          stdout: "hello world",
          stderr: "",
          exitCode: 0,
          durationMs: expect.any(Number),
          stdoutBytes: expect.any(Number),
          stderrBytes: expect.any(Number),
        }),
      })
    );
  });
});
