import { buildSegments } from "../SkillHighlightOverlay";

describe("buildSegments", () => {
  const recognizedSkillNames = new Set(["debug-trace"]);
  const recognizedCommandNames = new Set(["clear"]);

  it("highlights executable command tokens at the start of the prompt", () => {
    expect(
      buildSegments(
        "/clear fix this",
        recognizedSkillNames,
        recognizedCommandNames
      )
    ).toEqual([
      { text: "/clear", highlighted: true },
      { text: " fix this", highlighted: false },
    ]);
  });

  it("does not highlight command mentions outside executable position", () => {
    expect(
      buildSegments(
        "what does /clear do?",
        recognizedSkillNames,
        recognizedCommandNames
      )
    ).toEqual([{ text: "what does /clear do?", highlighted: false }]);
  });

  it("does not highlight command names followed by punctuation", () => {
    expect(
      buildSegments("/clear.", recognizedSkillNames, recognizedCommandNames)
    ).toEqual([{ text: "/clear.", highlighted: false }]);
  });

  it("still highlights skill tokens outside the start of the prompt", () => {
    expect(
      buildSegments(
        "please /debug-trace this",
        recognizedSkillNames,
        recognizedCommandNames
      )
    ).toEqual([
      { text: "please ", highlighted: false },
      { text: "/debug-trace", highlighted: true },
      { text: " this", highlighted: false },
    ]);
  });
});
