import { type RefObject, useEffect, useRef } from "react";

import { createEvaluatorHostSubmit } from "@phoenix/agent/tools/approval";
import {
  fromOutputConfigDraft,
  toOutputConfigDrafts,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  applyDraftOperations,
  createEditLlmEvaluatorDraftClientAction,
  createReadLlmEvaluatorDraftClientAction,
  createSubmitLlmEvaluatorDraftClientAction,
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  type EditLlmEvaluatorDraftOperation,
  type EvaluatorSubmitResult,
  type LLMEvaluatorDraftSnapshot,
  type LlmEvaluatorDraftHost,
  READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  reconcileJudgeOperations,
  SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import { usePreferencesContext } from "@phoenix/contexts";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";

/**
 * Wires the open LLM-evaluator dialog up to the agent: builds a draft host that
 * snapshots the live evaluator + playground state, then registers the
 * read/edit client actions for the agent to drive. Judge ops are written back
 * to the playground store; every other field to the evaluator store. Pending
 * edits are cancelled and the actions unregistered on unmount.
 */
export const useLlmEvaluatorDraftRegistration = ({
  mode,
  evaluatorNodeId,
  handleSubmitRef,
}: {
  mode: "create" | "update";
  evaluatorNodeId?: string | null;
  handleSubmitRef: RefObject<() => Promise<EvaluatorSubmitResult>>;
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

  const draftHostRef = useRef<LlmEvaluatorDraftHost | null>(null);
  useEffect(() => {
    if (instanceId == null) {
      return undefined;
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
      submit: createEvaluatorHostSubmit({
        getHandleSubmit: () => handleSubmitRef.current,
        unmountedError: "The LLM-evaluator form is not mounted; cannot submit.",
      }),
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
    registerClientAction(
      SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
      createSubmitLlmEvaluatorDraftClientAction({
        getDraftHost,
        shouldAutoAccept: () =>
          agentStore.getState().permissions.edits === "bypass",
      })
    );
    return () => {
      draftHostRef.current = null;
      unregisterClientAction(READ_LLM_EVALUATOR_DRAFT_TOOL_NAME);
      unregisterClientAction(EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME);
      unregisterClientAction(SUBMIT_LLM_EVALUATOR_DRAFT_TOOL_NAME);
      for (const pendingEdit of Object.values(
        agentStore.getState().pendingLlmEvaluatorEditsByToolCallId
      )) {
        if (pendingEdit) {
          void pendingEdit.cancel?.();
        }
      }
    };
  }, [
    agentStore,
    store,
    playgroundStore,
    instanceId,
    mode,
    evaluatorNodeId,
    handleSubmitRef,
  ]);
};
