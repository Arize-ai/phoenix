import { decideClassification } from "../decision/decideClassification";
import { templateToDecisionPrompt } from "../decision/decisionPrompt";
import { formatTemplate } from "../template";
import type {
  ClassificationChoicesMap,
  CreateClassifierArgs,
  EvaluationResult,
  EvaluatorFn,
} from "../types/evals";
import { isDecisionModel } from "../utils/isDecisionModel";
import { generateClassification } from "./generateClassification";

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
export function createClassifierFn<
  RecordToEvaluate extends Record<string, unknown>,
>(args: CreateClassifierArgs): EvaluatorFn<RecordToEvaluate> {
  const { model, choices, promptTemplate, ...rest } = args;

  return async (args: RecordToEvaluate): Promise<EvaluationResult> => {
    const templateVariables = {
      ...args,
    };

    // Decision models get the template split into a rubric and the data it
    // applies to, which has to happen before the variables are filled in.
    const classification = isDecisionModel(model)
      ? await decideClassification({
          model,
          labels: choicesToLabels(choices),
          prompt: templateToDecisionPrompt({
            template: promptTemplate,
            variables: templateVariables,
          }),
          telemetry: rest.telemetry,
        })
      : await generateClassification({
          model,
          labels: choicesToLabels(choices),
          prompt: formatTemplate({
            template: promptTemplate,
            variables: templateVariables,
          }),
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
