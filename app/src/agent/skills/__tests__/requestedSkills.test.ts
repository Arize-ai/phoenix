import {
  findSkillTokens,
  parseRequestedSkills,
} from "@phoenix/agent/skills/requestedSkills";

describe("findSkillTokens", () => {
  it("finds a token at the start of the string", () => {
    const tokens = findSkillTokens("/debug-trace help");
    expect(tokens).toEqual([{ name: "debug-trace", start: 0, end: 12 }]);
  });

  it("finds a token after whitespace", () => {
    const tokens = findSkillTokens("please /annotate-spans now");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].name).toBe("annotate-spans");
    expect(
      "please /annotate-spans now".slice(tokens[0].start, tokens[0].end)
    ).toBe("/annotate-spans");
  });

  it("ignores a slash that does not follow whitespace (e.g. a path)", () => {
    expect(findSkillTokens("a/b/c")).toEqual([]);
  });

  it("finds multiple tokens", () => {
    const tokens = findSkillTokens("/debug-trace and /annotate-spans");
    expect(tokens.map((t) => t.name)).toEqual([
      "debug-trace",
      "annotate-spans",
    ]);
  });
});

describe("parseRequestedSkills", () => {
  const available = new Set(["debug-trace", "annotate-spans"]);

  it("returns only recognized skills", () => {
    expect(parseRequestedSkills("/debug-trace /nope", available)).toEqual([
      "debug-trace",
    ]);
  });

  it("dedupes repeated tokens preserving first-appearance order", () => {
    expect(
      parseRequestedSkills(
        "/annotate-spans then /debug-trace then /annotate-spans",
        available
      )
    ).toEqual(["annotate-spans", "debug-trace"]);
  });

  it("returns empty when there are no recognized tokens", () => {
    expect(parseRequestedSkills("just a normal message", available)).toEqual(
      []
    );
    expect(parseRequestedSkills("/unknown-skill", available)).toEqual([]);
  });
});
