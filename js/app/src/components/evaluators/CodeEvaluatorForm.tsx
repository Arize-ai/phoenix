import { useShallow } from "zustand/react/shallow";

import { ContainsEvaluatorForm } from "@phoenix/components/evaluators/ContainsEvaluatorForm";
import { ExactMatchEvaluatorForm } from "@phoenix/components/evaluators/ExactMatchEvaluatorForm";
import { JSONDistanceEvaluatorForm } from "@phoenix/components/evaluators/JSONDistanceEvaluatorForm";
import { LevenshteinDistanceEvaluatorForm } from "@phoenix/components/evaluators/LevenshteinDistanceEvaluatorForm";
import { RegexEvaluatorForm } from "@phoenix/components/evaluators/RegexEvaluatorForm";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

export const CodeEvaluatorForm = () => {
  const { evaluatorKind, isBuiltin, builtInEvaluatorName } = useEvaluatorStore(
    useShallow((state) => ({
      evaluatorKind: state.evaluator.kind,
      isBuiltin: state.evaluator.isBuiltin,
      builtInEvaluatorName: state.evaluator.globalName,
      evaluatorMappingSource: state.evaluatorMappingSource,
    }))
  );
  if (evaluatorKind !== "BUILTIN") {
    throw new Error("CodeEvaluatorForm called for non-BUILTIN evaluator");
  }
  if (isBuiltin && builtInEvaluatorName) {
    switch (builtInEvaluatorName.toLowerCase()) {
      case "contains": {
        return <ContainsEvaluatorForm />;
      }
      case "exact_match": {
        return <ExactMatchEvaluatorForm />;
      }
      case "regex": {
        return <RegexEvaluatorForm />;
      }
      case "levenshtein_distance": {
        return <LevenshteinDistanceEvaluatorForm />;
      }
      case "json_distance": {
        return <JSONDistanceEvaluatorForm />;
      }
    }
  }
  throw new Error(
    "Unknown built-in evaluator or code evaluator not implemented"
  );
};
