import { css } from "@emotion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import {
  fromOutputConfigDraft,
  toOutputConfigDrafts,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  applyDraftOperations,
  createEditLlmEvaluatorDraftClientAction,
  createReadLlmEvaluatorDraftClientAction,
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  type EditLlmEvaluatorDraftOperation,
  type LLMEvaluatorDraftSnapshot,
  type LlmEvaluatorDraftHost,
  READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  reconcileJudgeOperations,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
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
import { usePreferencesContext } from "@phoenix/contexts";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";

export const EditLLMEvaluatorDialogContent = ({
  onSubmit,
  isSubmitting,
  mode,
  error,
  evaluatorNodeId,
}: {
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  mode: "create" | "update";
  error?: string;
  evaluatorNodeId?: string | null;
}) => {
  const store = useEvaluatorStoreInstance();
  const agentStore = useAgentStore();
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = instances[0]?.id;
  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );
  // Via a ref so the long-lived registration effect reads the latest provider configs without re-registering.
  const modelConfigByProviderRef = useRef(modelConfigByProvider);
  modelConfigByProviderRef.current = modelConfigByProvider;

  useAdvertiseAgentContext(
    useMemo(
      () => ({
        type: "llm_evaluator" as const,
        evaluatorNodeId: evaluatorNodeId ?? null,
      }),
      [evaluatorNodeId]
    )
  );

  const draftHostRef = useRef<LlmEvaluatorDraftHost | null>(null);
  useEffect(() => {
    if (instanceId == null) {
      return;
    }
    const buildSnapshot = (): LLMEvaluatorDraftSnapshot => {
      const state = store.getState();
      const { promptInput } = getInstancePromptParamsFromStore(
        instanceId,
        playgroundStore
      );
      return {
        mode: mode === "create" ? "create" : "edit",
        evaluatorNodeId: evaluatorNodeId ?? null,
        name: state.evaluator.name || state.evaluator.globalName,
        description: state.evaluator.description,
        inputMapping: state.evaluator.inputMapping,
        testPayload: state.evaluatorMappingSource,
        includeExplanation: state.evaluator.includeExplanation,
        outputConfigs: toOutputConfigDrafts(state.outputConfigs),
        judge: {
          model: promptInput.modelName,
          provider: promptInput.modelProvider,
          templateFormat: promptInput.templateFormat,
          messages: promptInput.template.messages,
          invocationParameters: promptInput.invocationParameters,
          tools: promptInput.tools?.tools ?? null,
          toolChoice: promptInput.tools?.toolChoice ?? null,
        },
      };
    };

    const previewOperations = (
      snapshot: LLMEvaluatorDraftSnapshot,
      operations: EditLlmEvaluatorDraftOperation[]
    ) => applyDraftOperations({ snapshot, operations });

    // Judge ops go to the playground store; every other field to evaluatorStore.
    const applyOperations = (operations: EditLlmEvaluatorDraftOperation[]) => {
      const current = buildSnapshot();
      const proposed = previewOperations(current, operations);
      if (!proposed.ok) return proposed;
      const next = proposed.output;
      const state = store.getState();
      if (next.name !== current.name) {
        if (mode === "create") {
          state.setEvaluatorGlobalName(next.name);
        }
        state.setEvaluatorName(next.name);
      }
      if (next.description !== current.description) {
        state.setEvaluatorDescription(next.description);
      }
      if (next.includeExplanation !== current.includeExplanation) {
        state.setIncludeExplanation(next.includeExplanation);
      }
      if (
        JSON.stringify(next.outputConfigs) !==
        JSON.stringify(current.outputConfigs)
      ) {
        state.setOutputConfigs(next.outputConfigs.map(fromOutputConfigDraft));
      }
      if (
        JSON.stringify(next.inputMapping.pathMapping) !==
        JSON.stringify(current.inputMapping.pathMapping)
      ) {
        state.setPathMapping(next.inputMapping.pathMapping);
      }
      if (
        JSON.stringify(next.inputMapping.literalMapping) !==
        JSON.stringify(current.inputMapping.literalMapping)
      ) {
        state.setLiteralMapping(next.inputMapping.literalMapping);
      }
      if (
        JSON.stringify(next.testPayload) !== JSON.stringify(current.testPayload)
      ) {
        state.setEvaluatorMappingSource(next.testPayload);
      }
      reconcileJudgeOperations({
        playgroundStore,
        instanceId,
        modelConfigByProvider: modelConfigByProviderRef.current,
        operations,
      });
      return { ok: true as const, output: buildSnapshot() };
    };

    const host: LlmEvaluatorDraftHost = {
      getSnapshot: buildSnapshot,
      previewOperations,
      applyOperations,
    };
    draftHostRef.current = host;

    const {
      registerClientAction,
      unregisterClientAction,
      setPendingLlmEvaluatorEdit,
    } = agentStore.getState();
    const getDraftHost = () => draftHostRef.current;
    registerClientAction(
      READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
      createReadLlmEvaluatorDraftClientAction({ getDraftHost })
    );
    registerClientAction(
      EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
      createEditLlmEvaluatorDraftClientAction({
        getDraftHost,
        setPendingLlmEvaluatorEdit,
        shouldAutoAccept: () =>
          agentStore.getState().permissions.edits === "bypass",
      })
    );
    return () => {
      draftHostRef.current = null;
      unregisterClientAction(READ_LLM_EVALUATOR_DRAFT_TOOL_NAME);
      unregisterClientAction(EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME);
      for (const pendingEdit of Object.values(
        agentStore.getState().pendingLlmEvaluatorEditsByToolCallId
      )) {
        if (pendingEdit) {
          void pendingEdit.cancel?.();
        }
      }
    };
  }, [agentStore, store, playgroundStore, instanceId, mode, evaluatorNodeId]);

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
