import { css } from "@emotion/react";
import { type ReactNode, useMemo, useRef, useState } from "react";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { Alert } from "@phoenix/components/core/alert";
import { Button } from "@phoenix/components/core/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { EvaluatorDatasetTestPanel } from "@phoenix/components/evaluators/EvaluatorDatasetTestPanel";
import { EvaluatorForm } from "@phoenix/components/evaluators/EvaluatorForm";
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
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {title ??
            (mode === "create" ? "Create LLM Evaluator" : "Edit LLM Evaluator")}
        </DialogTitle>
        <DialogTitleExtra>
          <Button slot="close" isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            data-testid="llm-evaluator-form-submit-button"
            data-mode={mode}
            variant="primary"
            isDisabled={isSubmitting || isSubmitDisabled}
            isPending={isSubmitting}
            onPress={handleSubmit}
          >
            {mode === "create" ? "Create" : "Update"}
          </Button>
        </DialogTitleExtra>
      </DialogHeader>
      <fieldset
        disabled={isSubmitting}
        css={css`
          all: unset;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          gap: var(--global-dimension-size-200);
          overflow: auto;
        `}
      >
        {showValidationError && (
          <Alert
            variant="danger"
            title="Please fix the highlighted errors before submitting."
          />
        )}
        {error && (
          <Alert
            variant="danger"
            title={
              mode === "create"
                ? "Failed to create evaluator"
                : "Failed to update evaluator"
            }
          >
            {error}
          </Alert>
        )}
        <LLMEvaluatorInputVariablesProvider>
          <EvaluatorForm
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
        </LLMEvaluatorInputVariablesProvider>
      </fieldset>
    </DialogContent>
  );
};
