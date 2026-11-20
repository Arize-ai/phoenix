import { type ReactNode, useMemo, useRef, useState } from "react";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { LLMEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/LLMEvaluatorInputVariablesProvider";
import { EvaluatorValidationBanner } from "@phoenix/components/evaluators/EvaluatorValidationBanner";
import { useLlmEvaluatorDraftRegistration } from "@phoenix/components/evaluators/useLlmEvaluatorDraftRegistration";
import {
  EvaluatorWorkspaceProvider,
  EvaluatorWorkspaceResetButton,
} from "@phoenix/components/evaluators/workspace/EvaluatorWorkspace";
import type { EvaluatorWorkspaceLayout } from "@phoenix/components/evaluators/workspace/evaluatorWorkspaceModel";
import { EVALUATOR_VALIDATION_MESSAGE } from "@phoenix/constants";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";

export const EditLLMEvaluatorDialogContent = ({
  onSubmit,
  isSubmitting,
  isSubmitDisabled = false,
  submitHint,
  mode,
  error,
  llmEvaluatorNodeId,
  title,
  workspace,
}: {
  onClose: () => void;
  onSubmit: () => Promise<EvaluatorSubmitResult>;
  isSubmitting: boolean;
  isSubmitDisabled?: boolean;
  submitHint?: ReactNode;
  mode: "create" | "update";
  error?: string;
  llmEvaluatorNodeId?: string | null;
  title?: string;
  /**
   * The form's panels, laid out as a workspace: `content` renders an
   * {@link EvaluatorWorkspace} for `layout`.
   */
  workspace: { layout: EvaluatorWorkspaceLayout; content: ReactNode };
}) => {
  const store = useEvaluatorStoreInstance();

  useAdvertiseAgentContext(
    useMemo(
      () => ({
        type: "llm_evaluator" as const,
        evaluatorNodeId: llmEvaluatorNodeId ?? null,
      }),
      [llmEvaluatorNodeId]
    )
  );

  const [showValidationError, setShowValidationError] = useState(false);
  const handleSubmit = async (): Promise<EvaluatorSubmitResult> => {
    const isValid = await store.getState().validateAll();
    if (!isValid) {
      setShowValidationError(true);
      return {
        ok: false,
        error: EVALUATOR_VALIDATION_MESSAGE,
      };
    }
    setShowValidationError(false);
    return onSubmit();
  };

  const handleSubmitRef = useRef(handleSubmit);
  // eslint-disable-next-line react/refs
  handleSubmitRef.current = handleSubmit;

  useLlmEvaluatorDraftRegistration({
    mode,
    llmEvaluatorNodeId,
    handleSubmitRef,
  });
  return (
    <EvaluatorWorkspaceProvider layout={workspace.layout}>
      <EvaluatorFormDialogContent
        title={
          title ??
          (mode === "create" ? "Create LLM Evaluator" : "Edit LLM Evaluator")
        }
        submitLabel={mode === "create" ? "Create" : "Update"}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isSubmitDisabled={isSubmitDisabled}
        submitHint={submitHint}
        error={error}
        errorTitle={
          mode === "create"
            ? "Failed to create evaluator"
            : "Failed to update evaluator"
        }
        banner={showValidationError ? <EvaluatorValidationBanner /> : null}
        submitButtonProps={{
          "data-testid": "llm-evaluator-form-submit-button",
          "data-mode": mode,
        }}
        renderInputVariables={(form) => (
          <LLMEvaluatorInputVariablesProvider>
            {form}
          </LLMEvaluatorInputVariablesProvider>
        )}
        workspace={workspace.content}
        headerExtra={<EvaluatorWorkspaceResetButton />}
      />
    </EvaluatorWorkspaceProvider>
  );
};
