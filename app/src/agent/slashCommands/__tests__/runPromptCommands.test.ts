import { runPromptCommands } from "@phoenix/agent/slashCommands/runPromptCommands";
import type { PendingAgentMessage } from "@phoenix/store/agentStore";

function createContext() {
  return {
    startNewSession: vi.fn(() => "draft-session"),
    setPendingMessage:
      vi.fn<(sessionId: string, message: PendingAgentMessage) => void>(),
  };
}

describe("runPromptCommands", () => {
  it("clear with no remaining text starts a draft and stages nothing", () => {
    const context = createContext();
    runPromptCommands(
      { commandNames: ["clear"], text: "", requestedSkills: [] },
      context
    );
    expect(context.startNewSession).toHaveBeenCalledTimes(1);
    expect(context.setPendingMessage).not.toHaveBeenCalled();
  });

  it("clear with remaining text stages it for the draft surface", () => {
    const context = createContext();
    runPromptCommands(
      {
        commandNames: ["clear"],
        text: "fix this bug",
        requestedSkills: ["debug-trace"],
      },
      context
    );
    expect(context.setPendingMessage).toHaveBeenCalledWith("draft-session", {
      text: "fix this bug",
      requestedSkills: ["debug-trace"],
    });
  });

  it("throws on unrecognized command names", () => {
    const context = createContext();
    expect(() =>
      runPromptCommands(
        { commandNames: ["unknown"], text: "hello", requestedSkills: [] },
        context
      )
    ).toThrow("Unknown prompt command: unknown");
    expect(context.startNewSession).not.toHaveBeenCalled();
    expect(context.setPendingMessage).not.toHaveBeenCalled();
  });
});
