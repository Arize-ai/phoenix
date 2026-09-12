import { graphql } from "react-relay";
import type { Environment } from "relay-runtime";

import type { saveDatasetEvaluatorAttachCodeMutation } from "./__generated__/saveDatasetEvaluatorAttachCodeMutation.graphql";
import type { saveDatasetEvaluatorCreateCodeMutation } from "./__generated__/saveDatasetEvaluatorCreateCodeMutation.graphql";
import type { saveDatasetEvaluatorCreateLLMMutation } from "./__generated__/saveDatasetEvaluatorCreateLLMMutation.graphql";
import type { saveDatasetEvaluatorUpdateCodeMutation } from "./__generated__/saveDatasetEvaluatorUpdateCodeMutation.graphql";
import type { saveDatasetEvaluatorUpdateLLMMutation } from "./__generated__/saveDatasetEvaluatorUpdateLLMMutation.graphql";
import { commitEvaluatorMutation } from "./commitEvaluatorMutation";
import { updateSharedCodeEvaluator } from "./saveCodeEvaluatorSource";
import type { SaveEvaluatorSlotRequest, SavedEvaluatorSlot } from "./types";
import { toSavedPrompt } from "./types";

/** Saves a slot to a dataset: an LLM or code dataset evaluator. */
export function saveDatasetEvaluator(
  environment: Environment,
  request: SaveEvaluatorSlotRequest
): Promise<SavedEvaluatorSlot> {
  return request.preview.inlineLlmEvaluator
    ? saveLLM(environment, request)
    : saveCode(environment, request);
}

function getDatasetId(request: SaveEvaluatorSlotRequest): string {
  if (request.source.kind !== "dataset")
    throw new Error("Select a dataset before saving a dataset evaluator.");

  return request.source.datasetId;
}

async function saveLLM(
  environment: Environment,
  request: SaveEvaluatorSlotRequest
): Promise<SavedEvaluatorSlot> {
  const { target } = request;
  const llm = request.preview.inlineLlmEvaluator;

  if (!llm?.promptVersion || !llm.outputConfigs)
    throw new Error("Complete the evaluator configuration before saving.");

  const input = {
    name: request.name,
    description: request.description,
    datasetId: getDatasetId(request),
    inputMapping: request.inputMapping,
    promptVersion: llm.promptVersion,
    promptVersionId: request.promptVersionId,
    outputConfigs: llm.outputConfigs,
  };

  if (target.action === "update" && "datasetEvaluatorId" in target) {
    const response =
      await commitEvaluatorMutation<saveDatasetEvaluatorUpdateLLMMutation>(
        environment,
        updateLLMMutation,
        { input: { ...input, datasetEvaluatorId: target.datasetEvaluatorId } }
      );

    const { id, evaluator } = response.updateDatasetLlmEvaluator.evaluator;

    return {
      bindingId: id,
      bindingKind: "dataset",
      action: "updated",
      prompt: toSavedPrompt(evaluator),
    };
  }

  const response =
    await commitEvaluatorMutation<saveDatasetEvaluatorCreateLLMMutation>(
      environment,
      createLLMMutation,
      { input }
    );

  return {
    bindingId: response.createDatasetLlmEvaluator.evaluator.id,
    bindingKind: "dataset",
    action: "created",
    prompt: null,
  };
}

async function saveCode(
  environment: Environment,
  request: SaveEvaluatorSlotRequest
): Promise<SavedEvaluatorSlot> {
  const { target } = request;
  const code = request.preview.inlineCodeEvaluator;

  if (!code || !request.sandboxConfigId)
    throw new Error("Select a sandbox before saving a code evaluator.");

  const binding = {
    datasetId: getDatasetId(request),
    name: request.name,
    description: request.description,
    inputMapping: request.inputMapping,
    outputConfigs: code.outputConfigs,
  };

  if (target.action === "create") {
    const created =
      await commitEvaluatorMutation<saveDatasetEvaluatorCreateCodeMutation>(
        environment,
        createCodeMutation,
        {
          input: {
            ...code,
            name: request.name,
            description: request.description,
            sandboxConfigId: request.sandboxConfigId,
            inputMapping: request.inputMapping,
          },
        }
      );

    return attachCode(environment, {
      ...binding,
      evaluatorId: created.createCodeEvaluator.evaluator.id,
    });
  }

  await updateSharedCodeEvaluator(environment, request, target.evaluatorId);

  if (target.action === "attach")
    return attachCode(environment, {
      ...binding,
      evaluatorId: target.evaluatorId,
    });

  if (!("datasetEvaluatorId" in target))
    throw new Error("Select a dataset before saving a dataset evaluator.");

  const response =
    await commitEvaluatorMutation<saveDatasetEvaluatorUpdateCodeMutation>(
      environment,
      updateCodeMutation,
      {
        input: {
          datasetEvaluatorId: target.datasetEvaluatorId,
          name: binding.name,
          description: binding.description,
          inputMapping: binding.inputMapping,
          outputConfigs: binding.outputConfigs,
        },
      }
    );

  return {
    bindingId: response.updateDatasetCodeEvaluator.evaluator.id,
    bindingKind: "dataset",
    action: "updated",
    prompt: null,
  };
}

async function attachCode(
  environment: Environment,
  input: saveDatasetEvaluatorAttachCodeMutation["variables"]["input"]
): Promise<SavedEvaluatorSlot> {
  const response =
    await commitEvaluatorMutation<saveDatasetEvaluatorAttachCodeMutation>(
      environment,
      attachCodeMutation,
      { input }
    );

  return {
    bindingId: response.createDatasetCodeEvaluator.evaluator.id,
    bindingKind: "dataset",
    action: "created",
    prompt: null,
  };
}

const createLLMMutation = graphql`
  mutation saveDatasetEvaluatorCreateLLMMutation(
    $input: CreateDatasetLLMEvaluatorInput!
  ) {
    createDatasetLlmEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

// Updates return the slot source's shape so a later reload of the same
// evaluator reads fresh data from the Relay store.
const updateLLMMutation = graphql`
  mutation saveDatasetEvaluatorUpdateLLMMutation(
    $input: UpdateDatasetLLMEvaluatorInput!
  ) {
    updateDatasetLlmEvaluator(input: $input) {
      evaluator {
        ...EvaluatorSlot_datasetEvaluator @relay(mask: false)
      }
    }
  }
`;

const createCodeMutation = graphql`
  mutation saveDatasetEvaluatorCreateCodeMutation(
    $input: CreateCodeEvaluatorInput!
  ) {
    createCodeEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

const attachCodeMutation = graphql`
  mutation saveDatasetEvaluatorAttachCodeMutation(
    $input: CreateDatasetCodeEvaluatorInput!
  ) {
    createDatasetCodeEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

const updateCodeMutation = graphql`
  mutation saveDatasetEvaluatorUpdateCodeMutation(
    $input: UpdateDatasetCodeEvaluatorInput!
  ) {
    updateDatasetCodeEvaluator(input: $input) {
      evaluator {
        ...EvaluatorSlot_datasetEvaluator @relay(mask: false)
      }
    }
  }
`;
