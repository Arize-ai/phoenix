import { Alert } from "@phoenix/components";

export const EVALUATOR_VALIDATION_MESSAGE =
  "Please fix the highlighted errors before submitting.";

/**
 * The banner an evaluator form shows above its fields when a submit attempt
 * finds invalid fields; the fields themselves carry the details.
 */
export function EvaluatorValidationBanner() {
  return <Alert variant="danger" title={EVALUATOR_VALIDATION_MESSAGE} />;
}
