import { useState } from "react";

import { CodeEvaluatorForm } from "@phoenix/components/evaluators/CodeEvaluatorForm";
import { makeDatasetEvaluatorFormLayout } from "@phoenix/components/evaluators/datasetEvaluatorFormLayout";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { EvaluatorValidationBanner } from "@phoenix/components/evaluators/EvaluatorValidationBanner";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";

export const EditBuiltInEvaluatorDialogContent = ({
  onSubmit,
  isSubmitting,
  mode,
  error,
  evaluatorInputSchema,
}: {
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  mode: "create" | "update";
  error?: string;
  evaluatorInputSchema: unknown;
}) => {
  const store = useEvaluatorStoreInstance();
  const [showValidationError, setShowValidationError] = useState(false);
  const handleSubmit = async () => {
    const isValid = await store.getState().validateAll();
    if (!isValid) {
      setShowValidationError(true);
      return;
    }
    setShowValidationError(false);
    onSubmit();
  };
  return (
    <EvaluatorFormDialogContent
      title={
        mode === "create"
          ? "Create Built-in Code Evaluator"
          : "Edit Built-in Code Evaluator"
      }
      submitLabel={mode === "create" ? "Create" : "Update"}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      error={error}
      errorTitle={
        mode === "create"
          ? "Failed to create evaluator"
          : "Failed to update evaluator"
      }
      banner={showValidationError ? <EvaluatorValidationBanner /> : null}
      submitButtonProps={{
        "data-testid": "builtin-evaluator-form-submit-button",
        "data-mode": mode,
      }}
      renderInputVariables={(body) => (
        <CodeEvaluatorInputVariablesProvider
          evaluatorInputSchema={evaluatorInputSchema}
        >
          {body}
        </CodeEvaluatorInputVariablesProvider>
      )}
      {...makeDatasetEvaluatorFormLayout({
        evaluatorKind: "builtin",
        identity: <EvaluatorNameAndDescriptionFields />,
        sections: [
          {
            id: "configuration",
            title: "Configuration",
            content: <CodeEvaluatorForm />,
          },
        ],
      })}
    />
  );
};
