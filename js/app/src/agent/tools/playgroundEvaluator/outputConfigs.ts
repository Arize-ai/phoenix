import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";

import { fromOutputConfigDraft } from "../codeEvaluatorDraft/outputConfigConverters";
import type { EvaluatorTaskOutputConfig } from "./schemas";

/**
 * The evaluator store's configs for the outputs an edit supplies. A config
 * without a `kind` is categorical: the read always reports one, but the
 * judge's labels are the common case and may be written bare.
 */
export function toEvaluatorTaskOutputConfigs(
  configs: EvaluatorTaskOutputConfig[]
): AnnotationConfig[] {
  return configs.map((config) =>
    fromOutputConfigDraft(
      config.kind === "continuous" || config.kind === "freeform"
        ? config
        : { ...config, kind: "classification" }
    )
  );
}
