import { type ReactNode, useMemo, useRef, useState } from "react";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { Alert } from "@phoenix/components/core/alert";
import { EvaluatorDatasetTestPanel } from "@phoenix/components/evaluators/EvaluatorDatasetTestPanel";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { LLMEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/LLMEvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { useLlmEvaluatorDraftRegistration } from "@phoenix/components/evaluators/useLlmEvaluatorDraftRegistration";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";

export const EditLLMEvaluatorDialogContent = ({
  onSubmit,
  isSubmitting,
  isSubmitDisabled = false,
  mode,
  error,
  evaluatorNodeId,
  title,
  formLeftPanelExtra,
  formLeftPanel,
  formRightPanel,
}: {
  onClose: () => void;
  onSubmit: () => Promise<EvaluatorSubmitResult>;
  isSubmitting: boolean;
  /** Disables submit while some external form state (e.g. a filter) is invalid. */
  isSubmitDisabled?: boolean;
  mode: "create" | "update";
  error?: string;
  evaluatorNodeId?: string | null;
  title?: string;
  /**
   * Optional section rendered in the form's left panel below name/description.
   */
  formLeftPanelExtra?: ReactNode;
  /** Replaces the form's left configuration panel. */
  formLeftPanel?: ReactNode;
  /**
   * Replaces the form's right (test) panel.
   */
  formRightPanel?: ReactNode;
}) => {
  const store = useEvaluatorStoreInstance();

  useAdvertiseAgentContext(
    useMemo(
      () => ({
        type: "llm_evaluator" as const,
        evaluatorNodeId: evaluatorNodeId ?? null,
      }),
      [evaluatorNodeId]
    )
  );

  const [showValidationError, setShowValidationError] = useState(false);
  const handleSubmit = async (): Promise<EvaluatorSubmitResult> => {
    const isValid = await store.getState().validateAll();
    if (!isValid) {
      setShowValidationError(true);
      return {
        ok: false,
        error: "Please fix the highlighted errors before submitting.",
      };
    }
    setShowValidationError(false);
    return onSubmit();
  };

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useLlmEvaluatorDraftRegistration({
    mode,
    evaluatorNodeId,
    handleSubmitRef,
  });
  return (
    <EvaluatorFormDialogContent
      title={
        title ??
        (mode === "create" ? "Create LLM Evaluator" : "Edit LLM Evaluator")
      }
      submitLabel={mode === "create" ? "Create" : "Update"}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      isSubmitDisabled={isSubmitDisabled}
      error={error}
      errorTitle={
        mode === "create"
          ? "Failed to create evaluator"
          : "Failed to update evaluator"
      }
      banner={
        showValidationError ? (
          <Alert
            variant="danger"
            title="Please fix the highlighted errors before submitting."
          />
        ) : null
      }
      submitButtonProps={{
        "data-testid": "llm-evaluator-form-submit-button",
        "data-mode": mode,
      }}
      renderInputVariables={(form) => (
        <LLMEvaluatorInputVariablesProvider>
          {form}
        </LLMEvaluatorInputVariablesProvider>
      )}
      left={
        formLeftPanel ?? (
          <>
            <EvaluatorNameAndDescriptionFields />
            {formLeftPanelExtra}
            <LLMEvaluatorForm />
          </>
        )
      }
      right={formRightPanel ?? <EvaluatorDatasetTestPanel />}
    />
  );
};
