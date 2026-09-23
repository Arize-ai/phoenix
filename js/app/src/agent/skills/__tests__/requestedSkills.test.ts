import { parseRequestedSkills } from "@phoenix/agent/skills/requestedSkills";

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
