import { parsePromptCommands } from "@phoenix/agent/slashCommands/promptCommands";

describe("parsePromptCommands", () => {
  const available = new Set(["clear"]);

  it("recognizes a lone command and strips it", () => {
    expect(parsePromptCommands("/clear", available)).toEqual({
      commandNames: ["clear"],
      text: "",
    });
  });

  it("strips a leading command and keeps the rest of the message", () => {
    expect(parsePromptCommands("/clear fix this bug", available)).toEqual({
      commandNames: ["clear"],
      text: "fix this bug",
    });
  });

  it("strips a mid-message command without doubling whitespace", () => {
    expect(parsePromptCommands("fix /clear this bug", available)).toEqual({
      commandNames: ["clear"],
      text: "fix this bug",
    });
  });

  it("leaves unknown tokens (potential skills) untouched", () => {
    expect(parsePromptCommands("/clear /debug-trace why", available)).toEqual({
      commandNames: ["clear"],
      text: "/debug-trace why",
    });
  });

  it("dedupes repeated commands but strips every occurrence", () => {
    expect(parsePromptCommands("/clear and /clear again", available)).toEqual({
      commandNames: ["clear"],
      text: "and again",
    });
  });

  it("returns the text unchanged when nothing is recognized", () => {
    expect(parsePromptCommands("just a message", available)).toEqual({
      commandNames: [],
      text: "just a message",
    });
  });

  it("does not treat path-like slashes as commands", () => {
    expect(parsePromptCommands("see a/clear/b", available)).toEqual({
      commandNames: [],
      text: "see a/clear/b",
    });
  });
});
