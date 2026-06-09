import { findSlashTokens } from "@phoenix/agent/slashCommands/slashTokens";

describe("findSlashTokens", () => {
  it("finds a token at the start of the string", () => {
    const tokens = findSlashTokens("/debug-trace help");
    expect(tokens).toEqual([{ name: "debug-trace", start: 0, end: 12 }]);
  });

  it("finds a token after whitespace", () => {
    const tokens = findSlashTokens("please /annotate-spans now");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].name).toBe("annotate-spans");
    expect(
      "please /annotate-spans now".slice(tokens[0].start, tokens[0].end)
    ).toBe("/annotate-spans");
  });

  it("ignores a slash that does not follow whitespace (e.g. a path)", () => {
    expect(findSlashTokens("a/b/c")).toEqual([]);
  });

  it("finds multiple tokens", () => {
    const tokens = findSlashTokens("/debug-trace and /annotate-spans");
    expect(tokens.map((t) => t.name)).toEqual([
      "debug-trace",
      "annotate-spans",
    ]);
  });
});
