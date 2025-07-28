import { createClassifier } from "./createClassifier";
import { CreateClassifierArgs, EvaluatorFn } from "../types/evals";
import {
  RAG_RELEVANCY_TEMPLATE,
  RAG_RELEVANCY_CHOICES,
} from "../default_templates/RAG_RELEVANCY_TEMPLATE";

export interface RAGRelevancyEvaluatorArgs
  extends Omit<CreateClassifierArgs, "promptTemplate" | "choices"> {
  choices?: CreateClassifierArgs["choices"];
  promptTemplate?: CreateClassifierArgs["promptTemplate"];
}

type RAGRelevancyExample = {
  input: string;
  documentText: string;
};
/**
 * Creates a function that evaluates whether a reference text is relevant to an input question.
 *
 * @param args - The arguments for creating the RAG relevancy evaluator.
 * @returns A function that evaluates whether a reference text is relevant to an input question.
 */
export function createRagRelevancyEvaluator(
  args: RAGRelevancyEvaluatorArgs
): EvaluatorFn<RAGRelevancyExample> {
  const {
    choices = RAG_RELEVANCY_CHOICES,
    promptTemplate = RAG_RELEVANCY_TEMPLATE,
    ...rest
  } = args;
  const ragRelevancyEvaluatorFn = createClassifier<RAGRelevancyExample>({
    ...args,
    promptTemplate,
    choices,
    ...rest,
  });
  return ragRelevancyEvaluatorFn;
}
