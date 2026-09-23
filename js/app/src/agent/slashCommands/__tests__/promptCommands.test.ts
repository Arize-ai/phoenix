import {
  findPromptCommandTokens,
  parsePromptCommands,
} from "@phoenix/agent/slashCommands/promptCommands";

describe("findPromptCommandTokens", () => {
  const available = new Set(["clear", "compact"]);

  it("finds an executable command at the start of the prompt", () => {
    expect(findPromptCommandTokens("/clear fix this", available)).toEqual([
      { name: "clear", start: 0, end: 6 },
    ]);
  });

  it("does not find commands mid-message", () => {
    expect(findPromptCommandTokens("what does /clear do?", available)).toEqual(
      []
    );
  });

  it("does not find commands followed by punctuation", () => {
    expect(findPromptCommandTokens("/clear.", available)).toEqual([]);
    expect(findPromptCommandTokens("/clear, fix this", available)).toEqual([]);
  });
});

describe("parsePromptCommands", () => {
  const available = new Set(["clear", "compact"]);

  it("recognizes the compact command", () => {
    expect(parsePromptCommands("/compact", available)).toEqual({
      commandNames: ["compact"],
      text: "",
    });
  });

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

  it("leaves mid-message command mentions untouched", () => {
    expect(parsePromptCommands("fix /clear this bug", available)).toEqual({
      commandNames: [],
      text: "fix /clear this bug",
    });
  });

  it("leaves unknown tokens (potential skills) untouched", () => {
    expect(parsePromptCommands("/clear /debug-trace why", available)).toEqual({
      commandNames: ["clear"],
      text: "/debug-trace why",
    });
  });

  it("dedupes repeated commands but leaves non-leading mentions untouched", () => {
    expect(parsePromptCommands("/clear and /clear again", available)).toEqual({
      commandNames: ["clear"],
      text: "and /clear again",
    });
  });

  it("strips consecutive leading commands", () => {
    expect(parsePromptCommands("/clear /clear again", available)).toEqual({
      commandNames: ["clear"],
      text: "again",
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

  it("does not treat punctuation as part of a command invocation", () => {
    expect(parsePromptCommands("/clear.", available)).toEqual({
      commandNames: [],
      text: "/clear.",
    });
    expect(parsePromptCommands("/clear, fix this", available)).toEqual({
      commandNames: [],
      text: "/clear, fix this",
    });
  });
});
