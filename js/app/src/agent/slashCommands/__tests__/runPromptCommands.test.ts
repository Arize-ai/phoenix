import { runPromptCommands } from "@phoenix/agent/slashCommands/runPromptCommands";
import type { PendingAgentMessage } from "@phoenix/store/agentStore";

function createContext() {
  return {
    compactSession: vi.fn(),
    startNewSession: vi.fn(() => "draft-session"),
    setPendingMessage:
      vi.fn<(sessionId: string, message: PendingAgentMessage) => void>(),
  };
}

describe("runPromptCommands", () => {
  it("compact invokes compaction without a pending message", () => {
    const context = createContext();
    runPromptCommands(
      { commandNames: ["compact"], text: "", requestedSkills: [] },
      context
    );
    expect(context.compactSession).toHaveBeenCalledWith(undefined);
    expect(context.startNewSession).not.toHaveBeenCalled();
  });

  it("compact forwards remaining text to send after compaction", () => {
    const context = createContext();
    runPromptCommands(
      {
        commandNames: ["compact"],
        text: "continue investigating",
        requestedSkills: ["debug-trace"],
      },
      context
    );
    expect(context.compactSession).toHaveBeenCalledWith({
      text: "continue investigating",
      requestedSkills: ["debug-trace"],
    });
  });

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
    expect(context.compactSession).not.toHaveBeenCalled();
  });

  it("executes only the first command when distinct commands are combined", () => {
    const context = createContext();
    runPromptCommands(
      {
        commandNames: ["compact", "clear"],
        text: "continue",
        requestedSkills: [],
      },
      context
    );
    expect(context.compactSession).toHaveBeenCalledWith({
      text: "continue",
      requestedSkills: [],
    });
    expect(context.startNewSession).not.toHaveBeenCalled();
  });
});
