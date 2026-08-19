import type { ProjectEvaluatorTemplate } from "../projectEvaluatorTemplates";
import {
  buildTemplateCreationMode,
  getProjectEvaluatorTemplateChoices,
  getProjectEvaluatorTemplateMetadata,
} from "../projectEvaluatorTemplates";

const template = {
  name: "hallucination",
  description: "Detect unsupported claims.",
  choices: { grounded: 0, hallucinated: 1 },
  optimizationDirection: "MINIMIZE",
  messages: [],
} satisfies ProjectEvaluatorTemplate;

describe("project evaluator templates", () => {
  it("maps known templates to their gallery metadata", () => {
    expect(getProjectEvaluatorTemplateMetadata("hallucination")).toEqual({
      useCase: "Answer quality",
      scope: "span",
      recommended: true,
      kind: "LLM",
    });
  });

  it("uses safe fallback metadata for new backend templates", () => {
    expect(getProjectEvaluatorTemplateMetadata("new_template")).toEqual({
      useCase: "Other",
      scope: "span",
      recommended: false,
      kind: "LLM",
    });
  });

  it("validates choices before building the seeded creation mode", () => {
    expect(buildTemplateCreationMode(template)).toEqual({
      kind: "template",
      initialState: {
        name: "hallucination",
        description: "Detect unsupported claims.",
        outputConfigs: [
          {
            name: "hallucination",
            optimizationDirection: "MINIMIZE",
            values: [
              { label: "grounded", score: 0 },
              { label: "hallucinated", score: 1 },
            ],
          },
        ],
        defaultMessages: [],
        templateFormat: "MUSTACHE",
        includeExplanation: false,
      },
    });
    expect(
      getProjectEvaluatorTemplateChoices({ choices: { invalid: "score" } })
    ).toEqual([]);
  });
});
