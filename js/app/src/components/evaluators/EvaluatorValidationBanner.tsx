import { Alert } from "@phoenix/components";
import { EVALUATOR_VALIDATION_MESSAGE } from "@phoenix/constants";

/**
 * The banner an evaluator form shows above its fields when a submit attempt
 * finds invalid fields; the fields themselves carry the details.
 */
export function EvaluatorValidationBanner() {
  return <Alert variant="danger" title={EVALUATOR_VALIDATION_MESSAGE} />;
}
