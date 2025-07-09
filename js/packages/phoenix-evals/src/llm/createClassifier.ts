import { LanguageModel } from "ai";
import {
  ClassificationChoicesMap,
  EvaluationArgs,
  EvaluationResult,
} from "../types/evals";
import { generateClassification } from "./generateClassification";
import { formatTemplate } from "../template";

interface CreateClassifierArgs {
  /**
   * The LLM to use for classification / evaluation
   */
  model: LanguageModel;
  /**
   * The choices to classify the example into.
   * E.x. { "correct": 1, "incorrect": 0 }
   */
  choices: ClassificationChoicesMap;
  /**
   * The prompt template to use for classification
   */
  promptTemplate: string;
}

/**
 * Convert a mapping of choices to labels
 * Asserts that the choices are valid
 */
function choicesToLabels(
  choices: ClassificationChoicesMap
): [string, ...string[]] {
  const labels = Object.keys(choices);
  if (labels.length === 0) {
    throw new Error("No choices provided");
  }
  return labels as [string, ...string[]];
}

/**
 * A function that serves as a factory that will output a classification evaluator
 */
export function createClassifier<OutputType, InputType>(
  args: CreateClassifierArgs
) {
  const { model, choices, promptTemplate } = args;

  return async (
    args: EvaluationArgs<OutputType, InputType>
  ): Promise<EvaluationResult> => {
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
    });

    // Post-process the classification result and map it to the choices
    const score = choices[classification.label];

    return {
      score,
      ...classification,
    };
  };
}
