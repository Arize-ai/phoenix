import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { extractVariablesFromFString } from "@phoenix/components/templateEditor/language/fString";

import { toLLMEvaluatorVariables } from "../EvaluatorInputVariablesContext/useLLMEvaluatorVariables";

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
