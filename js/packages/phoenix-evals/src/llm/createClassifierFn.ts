import { formatTemplate } from "../template";
import type {
  ClassificationChoices,
  CreateClassifierArgs,
  EvaluationResult,
  EvaluatorFn,
} from "../types/evals";
import { generateClassification } from "./generateClassification";

/**
 * Convert choices to the labels the classifier may return.
 * Asserts that the choices are valid.
 */
function choicesToLabels(
  choices: ClassificationChoices
): [string, ...string[]] {
  const labels = Array.isArray(choices) ? [...choices] : Object.keys(choices);
  if (labels.length < 1) {
    throw new Error("No choices provided");
  }
  return labels as [string, ...string[]];
}

/**
 * A function that serves as a factory that will output a classification evaluator function
 */
export function createClassifierFn<
  RecordToEvaluate extends Record<string, unknown>,
>(args: CreateClassifierArgs): EvaluatorFn<RecordToEvaluate> {
  const { model, choices, promptTemplate, ...rest } = args;

  return async (args: RecordToEvaluate): Promise<EvaluationResult> => {
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

    if (Array.isArray(choices)) {
      return classification;
    }

    return {
      score: choices[classification.label],
      ...classification,
    };
  };
}
