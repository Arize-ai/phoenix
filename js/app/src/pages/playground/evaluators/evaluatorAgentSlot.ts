import {
  fromOutputConfigDraft,
  toOutputConfigDrafts,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { reconcileJudgeOperations } from "@phoenix/agent/tools/llmEvaluatorDraft";
import type { EditLlmEvaluatorDraftOperation } from "@phoenix/agent/tools/llmEvaluatorDraft";
import type { EvaluatorSlotEdit } from "@phoenix/agent/uiOperations/operations/evaluatorPlayground";
import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import { getEvaluatorOutputConfigValidationErrors } from "@phoenix/components/evaluators/utils";
import { getProviderKeyForGenerativeModelSDK } from "@phoenix/components/generative/modelProviderUtils";
import type { ModelCatalog } from "@phoenix/components/generative/useModelMenuData";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";
import type { PlaygroundStore } from "@phoenix/store/playground";
import type { ModelConfigByProvider } from "@phoenix/store/preferencesStore";
import type { CodeEvaluatorLanguage } from "@phoenix/types";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";
import type { SlotId } from "./evaluatorSlotTypes";

export type EvaluatorAgentSlot = {
  read: () => ReturnType<ReturnType<typeof createEvaluatorAgentSlot>["read"]>;
  edit: (input: EvaluatorSlotEdit) => Promise<UIOperationResult>;
  save: (revision: string) => Promise<UIOperationResult>;
};

/** The slot editor state that lives outside the evaluator store. */
export type EvaluatorSlotLocalState = {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  sandboxConfigId: string | null;
  selectedOutput: string;
};

/** Slot-scoped adapter. No global prompt or evaluator-dialog registrations. */
export function createEvaluatorAgentSlot({
  slotId,
  modelCatalog,
  sourceKey,
  saveTarget,
  kind,
  store,
  playgroundStore,
  getLocal,
  setLocal,
  getPreferences,
  sandboxConfigs,
  save,
}: {
  slotId: SlotId;
  modelCatalog: ModelCatalog;
  sourceKey: string;
  saveTarget: EvaluatorSaveTarget;
  kind: "LLM" | "CODE";
  store: EvaluatorStoreInstance;
  playgroundStore: PlaygroundStore | null;
  getLocal: () => EvaluatorSlotLocalState;
  setLocal: (local: EvaluatorSlotLocalState) => void;
  getPreferences: () => ModelConfigByProvider;
  sandboxConfigs: {
    id: string;
    name: string;
    language: CodeEvaluatorLanguage;
  }[];
  save: () => Promise<UIOperationResult>;
}) {
  function read() {
    const state = store.getState();
    const local = getLocal();
    const instanceId = playgroundStore?.getState().instances[0]?.id;

    const prompt =
      kind === "LLM" && playgroundStore && instanceId != null
        ? getInstancePromptParamsFromStore(instanceId, playgroundStore)
            .promptInput
        : null;

    const draft = {
      slot: slotId,
      sourceKey,
      kind,
      name: state.evaluator.globalName,
      description: state.evaluator.description,
      inputMapping: state.evaluator.inputMapping,
      outputConfigs: toOutputConfigDrafts(state.outputConfigs),
      selectedOutputName: state.outputConfigs.some(
        (config) => config.name === local.selectedOutput
      )
        ? local.selectedOutput
        : (state.outputConfigs[0]?.name ?? ""),
      ...(kind === "CODE"
        ? {
            language: local.language,
            sourceCode: local.sourceCode,
            sandboxConfigId: local.sandboxConfigId,
          }
        : { prompt, includeExplanation: state.evaluator.includeExplanation }),
    };

    return {
      ...draft,
      revision: JSON.stringify(draft),
      // What saveSlot does: update the loaded evaluator, attach a shared code
      // evaluator to the dataset, or create a new dataset evaluator.
      saveTarget,
      // Stated on every read so an agent learns the rule before its first edit
      // rather than from a rejected run.
      outputConfigRules:
        kind === "LLM"
          ? "LLM evaluators support only categorical outputs: the judge picks a label, and the score is that label's score. Express a numeric scale as scored labels (e.g. poor=0, fair=0.5, good=1). Continuous and freeform outputs are rejected on run and save."
          : "Code evaluators may declare categorical, continuous, or freeform outputs; the function returns the label and/or score.",
      availableSandboxConfigs: sandboxConfigs,
      availableModels: {
        providers: [...modelCatalog.installedBuiltInProviders],
        customProviders: modelCatalog.customProviders.map(
          ({ id, name, sdk }) => ({
            id,
            name,
            provider: getProviderKeyForGenerativeModelSDK(sdk),
          })
        ),
      },
    };
  }

  function applyLlm(input: EvaluatorSlotEdit) {
    if (kind !== "LLM" || !playgroundStore) return;

    const customProvider = modelCatalog.customProviders.find(
      (provider) => provider.id === input.model?.customProviderId
    );

    const operations: EditLlmEvaluatorDraftOperation[] = [];

    if (input.messages)
      operations.push({
        type: "set_judge_prompt",
        messages: input.messages,
        templateFormat: input.templateFormat,
      });
    else if (input.templateFormat)
      playgroundStore.getState().setTemplateFormat(input.templateFormat);

    if (input.model)
      operations.push({
        type: "set_judge_model",
        model: input.model.name,
        provider: input.model.provider,
        invocationParameters: input.model.invocationParameters,
      });
    reconcileJudgeOperations({
      playgroundStore,
      instanceId: playgroundStore.getState().instances[0].id,
      modelConfigByProvider: getPreferences(),
      operations,
    });

    if (input.model)
      playgroundStore.getState().updateModel({
        instanceId: playgroundStore.getState().instances[0].id,
        patch: {
          customProvider: customProvider
            ? { id: customProvider.id, name: customProvider.name }
            : null,
        },
      });
  }

  return {
    read,
    async edit(input: EvaluatorSlotEdit): Promise<UIOperationResult> {
      if (input.slot !== slotId || input.expectedRevision !== read().revision)
        return {
          ok: false,
          error: "Evaluator draft changed. Call readSlot again before editing.",
          code: "STALE_REVISION",
        };
      const local = getLocal();
      const state = store.getState();

      const validationError =
        validateSlotFields({ kind, input, local, saveTarget }) ??
        validateModel({ input, modelCatalog });

      if (validationError) return { ok: false, error: validationError };

      const outputConfigs =
        input.outputConfigs?.map((config) =>
          fromOutputConfigDraft(
            "kind" in config ? config : { ...config, kind: "classification" }
          )
        ) ?? state.outputConfigs;

      const errors = getEvaluatorOutputConfigValidationErrors({
        kind,
        configs: outputConfigs,
      });

      if (errors.length) return { ok: false, error: errors.join("\n") };

      if (
        input.selectedOutputName &&
        !outputConfigs.some(
          (config) => config.name === input.selectedOutputName
        )
      )
        return {
          ok: false,
          error: "Select an output from outputConfigs.",
        };
      const nextLocal = getNextLocal({ local, input });

      if (
        kind === "CODE" &&
        (input.language || input.sandboxConfigId) &&
        !sandboxConfigs.some(
          (config) =>
            config.id === nextLocal.sandboxConfigId &&
            config.language === nextLocal.language
        )
      )
        return {
          ok: false,
          error: "Choose a compatible sandbox from availableSandboxConfigs.",
        };

      // Validate the full patch before touching either store.
      if (input.name != null) state.setEvaluatorGlobalName(input.name);

      if (input.description != null)
        state.setEvaluatorDescription(input.description);

      if (input.outputConfigs) state.setOutputConfigs(outputConfigs);

      if (input.inputMapping) {
        state.setPathMapping(input.inputMapping.pathMapping);
        state.setLiteralMapping(input.inputMapping.literalMapping);
      }

      if (input.includeExplanation != null)
        state.setIncludeExplanation(input.includeExplanation);
      applyLlm(input);
      setLocal(nextLocal);

      return { ok: true, output: read() };
    },
    async save(revision: string): Promise<UIOperationResult> {
      if (revision !== read().revision)
        return {
          ok: false,
          error: "Evaluator draft changed. Call readSlot before saving.",
          code: "STALE_REVISION",
        };

      return save();
    },
  };
}

function getNextLocal({
  local,
  input,
}: {
  local: EvaluatorSlotLocalState;
  input: EvaluatorSlotEdit;
}): EvaluatorSlotLocalState {
  return {
    language: input.language ?? local.language,
    sourceCode: input.sourceCode ?? local.sourceCode,
    sandboxConfigId: input.sandboxConfigId ?? local.sandboxConfigId,
    selectedOutput: input.selectedOutputName ?? local.selectedOutput,
  };
}

function validateSlotFields({
  kind,
  input,
  local,
  saveTarget,
}: {
  kind: "LLM" | "CODE";
  input: EvaluatorSlotEdit;
  local: EvaluatorSlotLocalState;
  saveTarget: EvaluatorSaveTarget;
}): string | null {
  const hasLlmFields =
    input.messages != null ||
    input.model != null ||
    input.templateFormat != null ||
    input.includeExplanation != null;

  const hasCodeFields =
    input.sourceCode != null ||
    input.language != null ||
    input.sandboxConfigId != null;

  if (kind === "CODE" && hasLlmFields)
    return "LLM fields cannot be applied to a CODE slot.";

  if (kind === "LLM" && hasCodeFields)
    return "Code fields cannot be applied to an LLM slot.";

  if (
    input.language &&
    input.language !== local.language &&
    saveTarget.action !== "create"
  )
    return "A saved code evaluator keeps its language. Select a new code evaluator to change it.";

  return null;
}

function validateModel({
  input,
  modelCatalog,
}: {
  input: EvaluatorSlotEdit;
  modelCatalog: ModelCatalog;
}): string | null {
  if (!input.model) return null;
  const { provider, customProviderId } = input.model;

  if (!isModelProvider(provider)) return "Unknown model provider.";

  const customProvider = modelCatalog.customProviders.find(
    (config) => config.id === customProviderId
  );

  if (
    customProviderId &&
    (!customProvider ||
      getProviderKeyForGenerativeModelSDK(customProvider.sdk) !== provider)
  )
    return "Custom provider is unavailable or does not match the provider SDK.";

  if (!customProvider && !modelCatalog.installedBuiltInProviders.has(provider))
    return "Model provider dependencies are not installed.";

  return null;
}
