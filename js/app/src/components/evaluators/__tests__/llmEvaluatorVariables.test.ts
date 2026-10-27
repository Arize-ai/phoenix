import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { extractVariablesFromFString } from "@phoenix/components/templateEditor/language/fString";

import { toLLMEvaluatorVariables } from "../EvaluatorInputVariablesContext/useLLMEvaluatorVariables";
import { buildInputSchemaInput } from "../utils";

describe("toLLMEvaluatorVariables", () => {
  // A variable's row is named by what the prompt reads, so a name still being
  // typed adds no row of its own.
  it("reads each f-string name by its root, and skips names with none", () => {
    const names = extractVariablesFromFString(
      "{input.messages.} {input.messages[} {metadata.turns[-1].input} {} {.x} {score:.2f} {output}"
    );

    expect(
      toLLMEvaluatorVariables({
        names,
        templateFormat: TemplateFormats.FString,
      })
    ).toEqual(["input", "metadata", "score", "output"]);
    expect(
      toLLMEvaluatorVariables({
        names: ["input"],
        templateFormat: TemplateFormats.Mustache,
      })
    ).toEqual(["input"]);
  });
});

describe("the input schema an LLM evaluator saves", () => {
  // The save describes the same names the mapping rows show, so a description
  // written on an f-string row survives a dotted or formatted reference.
  it("keeps a description written on an f-string root", () => {
    expect(
      buildInputSchemaInput({
        variables: toLLMEvaluatorVariables({
          names: extractVariablesFromFString("{reference.label} {score:.2f}"),
          templateFormat: TemplateFormats.FString,
        }),
        inputDescriptions: { reference: "The expected label." },
      })
    ).toEqual({
      type: "object",
      properties: {
        reference: { description: "The expected label." },
        score: {},
      },
    });
  });
});
