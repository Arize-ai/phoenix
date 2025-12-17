import { useShallow } from "zustand/react/shallow";

import { ContainsEvaluatorForm } from "@phoenix/components/evaluators/ContainsEvaluatorForm";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

export const CodeEvaluatorForm = () => {
  const { evaluatorKind, isBuiltin, builtInEvaluatorName } = useEvaluatorStore(
    useShallow((state) => ({
      evaluatorKind: state.evaluator.kind,
      isBuiltin: state.evaluator.isBuiltin,
      builtInEvaluatorName: state.evaluator.name,
      preMappedInput: state.preMappedInput,
    }))
  );
  if (evaluatorKind !== "CODE") {
    throw new Error("CodeEvaluatorForm called for non-CODE evaluator");
  }
  if (isBuiltin && builtInEvaluatorName) {
    switch (builtInEvaluatorName.toLowerCase()) {
      case "contains": {
        return <ContainsEvaluatorForm />;
      }
    }
  }
  throw new Error(
    "Unknown built-in evaluator or code evaluator not implemented"
  );
};
