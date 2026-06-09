import { runPromptCommands } from "@phoenix/agent/slashCommands/runPromptCommands";
import type { PendingAgentMessage } from "@phoenix/store/agentStore";

function createContext() {
  return {
    createSession: vi.fn(() => "new-session"),
    setPendingMessage:
      vi.fn<(sessionId: string, message: PendingAgentMessage) => void>(),
  };
}

describe("runPromptCommands", () => {
  it("clear with no remaining text creates a session and stages nothing", () => {
    const context = createContext();
    runPromptCommands(
      { commandNames: ["clear"], text: "", requestedSkills: [] },
      context
    );
    expect(context.createSession).toHaveBeenCalledTimes(1);
    expect(context.setPendingMessage).not.toHaveBeenCalled();
  });

  it("clear with remaining text stages it for the new session", () => {
    const context = createContext();
    runPromptCommands(
      {
        commandNames: ["clear"],
        text: "fix this bug",
        requestedSkills: ["debug-trace"],
      },
      context
    );
    expect(context.setPendingMessage).toHaveBeenCalledWith("new-session", {
      text: "fix this bug",
      requestedSkills: ["debug-trace"],
    });
  });

  it("ignores unrecognized command names", () => {
    const context = createContext();
    runPromptCommands(
      { commandNames: ["unknown"], text: "hello", requestedSkills: [] },
      context
    );
    expect(context.createSession).not.toHaveBeenCalled();
    expect(context.setPendingMessage).not.toHaveBeenCalled();
  });
});
