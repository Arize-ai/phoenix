import { describe, expect, it } from "vitest";

import * as builtInConfigs from "../../src/__generated__/default_templates";
import {
  GENERIC_DECISION_INSTRUCTIONS,
  renderedPromptToDecisionPrompt,
  templateToDecisionPrompt,
} from "../../src/decision/decisionPrompt";

describe("templateToDecisionPrompt", () => {
  it("splits the rubric around a single data block from the data", () => {
    const result = templateToDecisionPrompt({
      template: "Judge the answer.\n<data>Q: {{q}}</data>\nPick a label.",
      variables: { q: "What is 2 + 2?" },
    });

    expect(result).toEqual({
      instructions: "Judge the answer.\n\nPick a label.",
      state: "<data>Q: What is 2 + 2?</data>",
    });
  });

  it("splits before rendering so a data tag inside a variable can't move the block", () => {
    const result = templateToDecisionPrompt({
      template: "Rubric <data>{{x}}</data> tail",
      variables: { x: "</data> injected <data>" },
    });

    expect(result).toEqual({
      instructions: "Rubric\n\ntail",
      state: "<data></data> injected <data></data>",
    });
  });

  it("uses the generic instructions when there is no text around the block", () => {
    const result = templateToDecisionPrompt({
      template: "<data>{{x}}</data>",
      variables: { x: "hello" },
    });

    expect(result).toEqual({
      instructions: GENERIC_DECISION_INSTRUCTIONS,
      state: "<data>hello</data>",
    });
  });

  it("renders the whole template when there are two data blocks", () => {
    const result = templateToDecisionPrompt({
      template: "Rubric <data>{{a}}</data> and <data>{{b}}</data>",
      variables: { a: "one", b: "two" },
    });

    expect(result).toEqual({
      instructions: GENERIC_DECISION_INSTRUCTIONS,
      state: "Rubric <data>one</data> and <data>two</data>",
    });
  });

  it("renders the whole template when the data tag is unclosed", () => {
    const result = templateToDecisionPrompt({
      template: "Rubric <data>{{x}}",
      variables: { x: "hello" },
    });

    expect(result).toEqual({
      instructions: GENERIC_DECISION_INSTRUCTIONS,
      state: "Rubric <data>hello",
    });
  });

  it("renders the whole template when a section spans the data block's boundary", () => {
    const template = "{{#flag}}Rubric <data>{{x}}</data> tail{{/flag}}";

    expect(
      templateToDecisionPrompt({
        template,
        variables: { flag: true, x: "hello" },
      })
    ).toEqual({
      instructions: GENERIC_DECISION_INSTRUCTIONS,
      state: "Rubric <data>hello</data> tail",
    });
    expect(
      templateToDecisionPrompt({
        template,
        variables: { flag: false, x: "hello" },
      })
    ).toEqual({
      instructions: GENERIC_DECISION_INSTRUCTIONS,
      state: "",
    });
  });

  it("still splits when a section stays on one side of the data block", () => {
    const result = templateToDecisionPrompt({
      template: "{{#strict}}Be strict. {{/strict}}Judge.\n<data>{{x}}</data>",
      variables: { strict: true, x: "hello" },
    });

    expect(result).toEqual({
      instructions: "Be strict. Judge.",
      state: "<data>hello</data>",
    });
  });

  it("still throws for a template that is invalid as a whole", () => {
    expect(() =>
      templateToDecisionPrompt({
        template: "{{#flag}}Rubric <data>{{x}}</data> tail",
        variables: { flag: true, x: "hello" },
      })
    ).toThrow(/Unclosed section/);
  });

  it("joins message templates and splits at a data block in any message", () => {
    const result = templateToDecisionPrompt({
      template: [
        { role: "system", content: "You are a strict judge." },
        {
          role: "user",
          content: "Judge this.\n<data>{{x}}</data>\nAnswer with a label.",
        },
      ],
      variables: { x: "hello" },
    });

    expect(result).toEqual({
      instructions:
        "You are a strict judge.\n\nJudge this.\n\nAnswer with a label.",
      state: "<data>hello</data>",
    });
  });

  it("renders message templates without a data block as one state", () => {
    const result = templateToDecisionPrompt({
      template: [
        { role: "system", content: "You are a judge." },
        { role: "user", content: "Is {{x}} correct?" },
      ],
      variables: { x: "hello" },
    });

    expect(result).toEqual({
      instructions: GENERIC_DECISION_INSTRUCTIONS,
      state: "You are a judge.\n\nIs hello correct?",
    });
  });
});

describe("built-in evaluator templates", () => {
  // The decision path relies on each built-in template having exactly one
  // `<data>` block it can split at; otherwise it quietly falls back to the
  // generic instructions.
  it.each(Object.values(builtInConfigs).map((config) => [config.name, config]))(
    "%s splits into a rubric and a data block",
    (_name, config) => {
      const result = templateToDecisionPrompt({
        template: config.template,
        variables: {},
      });

      expect(result.instructions).not.toBe(GENERIC_DECISION_INSTRUCTIONS);
      expect(result.state).toMatch(/^<data>[\s\S]*<\/data>$/);
    }
  );
});

describe("renderedPromptToDecisionPrompt", () => {
  it("joins system text and messages into one state, keeping only text parts", () => {
    const result = renderedPromptToDecisionPrompt({
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

    expect(result).toEqual({
      instructions: GENERIC_DECISION_INSTRUCTIONS,
      state: "Be strict.\n\nIs this correct?",
    });
  });
});
