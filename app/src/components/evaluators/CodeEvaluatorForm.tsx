import React from "react";
import { useFormContext } from "react-hook-form";

import { ContainsEvaluatorForm } from "@phoenix/components/evaluators/ContainsEvaluatorForm";
import type { EvaluatorFormValues } from "@phoenix/components/evaluators/EvaluatorForm";
import type { EvaluatorInput } from "@phoenix/components/evaluators/utils";

/**
 * @TODO move into zustand
 */
type CodeEvaluatorFormProps = {
  evaluatorInputObject: EvaluatorInput | null;
};

export const CodeEvaluatorForm = ({
  evaluatorInputObject,
}: CodeEvaluatorFormProps) => {
  const { watch } = useFormContext<EvaluatorFormValues>();
  const evaluatorKind = watch("evaluator.kind");
  const isBuiltin = watch("evaluator.isBuiltin");
  const builtInEvaluatorName = watch("evaluator.builtInEvaluatorName");
  if (evaluatorKind !== "CODE") {
    throw new Error("CodeEvaluatorForm called for non-CODE evaluator");
  }
  if (isBuiltin && builtInEvaluatorName) {
    switch (builtInEvaluatorName.toLowerCase()) {
      case "contains": {
        return (
          <ContainsEvaluatorForm evaluatorInputObject={evaluatorInputObject} />
        );
      }
    }
  }
  return <div>CodeEvaluatorForm</div>;
};
