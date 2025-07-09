import { createClassifier } from "./createClassifier";
import { CreateClassifierArgs } from "../types/evals";
import {
  HALLUCINATION_TEMPLATE,
  HALLUCINATION_CHOICES,
} from "../default_templates/HALLUCINATION_TEMPLATE";

interface HallucinationEvaluatorArgs
  extends Omit<CreateClassifierArgs, "promptTemplate" | "choices"> {
  choices?: CreateClassifierArgs["choices"];
  promptTemplate?: CreateClassifierArgs["promptTemplate"];
}
export function HallucinationEvaluator(args: HallucinationEvaluatorArgs) {
  const {
    choices = HALLUCINATION_CHOICES,
    promptTemplate = HALLUCINATION_TEMPLATE,
  } = args;
  const hallucinationEvaluatorFn = createClassifier({
    ...args,
    promptTemplate,
    choices,
  });
  return hallucinationEvaluatorFn;
}
