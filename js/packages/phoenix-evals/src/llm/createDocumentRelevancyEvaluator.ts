import { createClassifier } from "./createClassifier";
import { CreateClassifierArgs, EvaluatorFn } from "../types/evals";
import {
  DOCUMENT_RELEVANCY_TEMPLATE,
  DOCUMENT_RELEVANCY_CHOICES,
} from "../default_templates/DOCUMENT_RELEVANCY_TEMPLATE";

export interface DocumentRelevancyEvaluatorArgs
  extends Omit<CreateClassifierArgs, "promptTemplate" | "choices"> {
  choices?: CreateClassifierArgs["choices"];
  promptTemplate?: CreateClassifierArgs["promptTemplate"];
}

type DocumentRelevancyExample = {
  input: string;
  documentText: string;
};
/**
 * Creates a function that evaluates whether a reference text is relevant to an input question.
 *
 * @param args - The arguments for creating the document relevancy evaluator.
 * @returns A function that evaluates whether a reference text is relevant to an input question.
 */
export function createDocumentRelevancyEvaluator(
  args: DocumentRelevancyEvaluatorArgs
): EvaluatorFn<DocumentRelevancyExample> {
  const {
    choices = DOCUMENT_RELEVANCY_CHOICES,
    promptTemplate = DOCUMENT_RELEVANCY_TEMPLATE,
    ...rest
  } = args;
  const documentRelevancyEvaluatorFn =
    createClassifier<DocumentRelevancyExample>({
      ...args,
      promptTemplate,
      choices,
      ...rest,
    });
  return documentRelevancyEvaluatorFn;
}
