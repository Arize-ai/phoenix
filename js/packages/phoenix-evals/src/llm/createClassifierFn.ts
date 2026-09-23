import { formatTemplate } from "../template";
import type {
  ClassificationChoices,
  ClassificationChoicesMap,
  CreateClassifierArgs,
  EvaluationResult,
  EvaluatorFn,
} from "../types/evals";
import { generateClassification } from "./generateClassification";

/**
 * Whether the choices are a label-to-score map rather than a bare list of
 * labels. Custom guard so a `readonly string[]` is narrowed out correctly,
 * which `Array.isArray` does not do.
 */
function isChoicesMap(
  choices: ClassificationChoices
): choices is ClassificationChoicesMap {
  return !Array.isArray(choices);
}

/**
 * Convert choices to the labels the classifier may return.
 * Asserts that the choices are valid.
 */
function choicesToLabels(
  choices: ClassificationChoices
): [string, ...string[]] {
  const labels = isChoicesMap(choices) ? Object.keys(choices) : [...choices];
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

    if (!isChoicesMap(choices)) {
      return classification;
    }

    return {
      score: choices[classification.label],
      ...classification,
    };
  };
}
