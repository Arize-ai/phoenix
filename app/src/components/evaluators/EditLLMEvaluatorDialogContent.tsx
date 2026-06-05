import { css } from "@emotion/react";
import { useMemo, useRef, useState } from "react";

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
import { EvaluatorForm } from "@phoenix/components/evaluators/EvaluatorForm";
import { LLMEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/LLMEvaluatorInputVariablesProvider";
import { useLlmEvaluatorDraftRegistration } from "@phoenix/components/evaluators/useLlmEvaluatorDraftRegistration";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";

export const EditLLMEvaluatorDialogContent = ({
  onSubmit,
  isSubmitting,
  mode,
  error,
  evaluatorNodeId,
}: {
  onClose: () => void;
  onSubmit: () => Promise<EvaluatorSubmitResult>;
  isSubmitting: boolean;
  mode: "create" | "update";
  error?: string;
  evaluatorNodeId?: string | null;
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

  // The host's `submit` capability (registered once below) reads the current
  // validated `handleSubmit` through this ref, avoiding re-registration when
  // form state changes per keystroke.
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
          {mode === "create" ? "Create LLM Evaluator" : "Edit LLM Evaluator"}
        </DialogTitle>
        <DialogTitleExtra>
          <Button slot="close" isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            data-testid="llm-evaluator-form-submit-button"
            data-mode={mode}
            variant="primary"
            isDisabled={isSubmitting}
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
          <EvaluatorForm />
        </LLMEvaluatorInputVariablesProvider>
      </fieldset>
    </DialogContent>
  );
};
