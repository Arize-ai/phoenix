import { describe, expect, it } from "vitest";

import { promptToDecisionState } from "../../src/decision/decisionPrompt";

describe("promptToDecisionState", () => {
  it("passes a text prompt through unchanged", () => {
    expect(promptToDecisionState({ prompt: "Is hello correct?" })).toBe(
      "Is hello correct?"
    );
  });

  it("joins message prompts into one state", () => {
    const state = promptToDecisionState({
      prompt: [
        { role: "system", content: "You are a judge." },
        { role: "user", content: "Is hello correct?" },
      ],
    });

    expect(state).toBe("You are a judge.\n\nIs hello correct?");
  });

  it("joins system text and messages into one state, keeping only text parts", () => {
    const state = promptToDecisionState({
      system: "Be strict.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Is this correct?" },
            { type: "image", image: new URL("https://example.com/a.png") },
          ],
        },
      ],
    });

    expect(state).toBe("Be strict.\n\nIs this correct?");
  });
});
