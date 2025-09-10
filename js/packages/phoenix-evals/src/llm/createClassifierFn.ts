import {
  ClassificationChoicesMap,
  EvaluationResult,
  CreateClassifierArgs,
  EvaluatorFn,
} from "../types/evals";
import { generateClassification } from "./generateClassification";
import { formatTemplate } from "../template";

/**
 * Convert a mapping of choices to labels
 * Asserts that the choices are valid
 */
function choicesToLabels(
  choices: ClassificationChoicesMap
): [string, ...string[]] {
  const labels = Object.keys(choices);
  if (labels.length < 1) {
    throw new Error("No choices provided");
  }
  return labels as [string, ...string[]];
}

/**
 * A function that serves as a factory that will output a classification evaluator function
 */
export function createClassifierFn<ExampleType extends Record<string, unknown>>(
  args: CreateClassifierArgs
): EvaluatorFn<ExampleType> {
  const { model, choices, promptTemplate, ...rest } = args;

  return async (args: ExampleType): Promise<EvaluationResult> => {
    const templateVariables = {
      ...args,
    };

    const prompt = formatTemplate({
      template: promptTemplate,
      variables: templateVariables,
    });

    const classification = await generateClassification({
      model,
      labels: choicesToLabels(choices),
      prompt,
      ...rest,
    });

    // Post-process the classification result and map it to the choices
    const score = choices[classification.label];

    return {
      score,
      ...classification,
    };
  };
}
