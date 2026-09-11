import { useState } from "react";
import {
  commitMutation,
  fetchQuery,
  graphql,
  useRelayEnvironment,
} from "react-relay";
import type {
  Environment,
  GraphQLTaggedNode,
  MutationParameters,
} from "relay-runtime";

import type { EvaluatorPreviewInput } from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import type { PlaygroundInstancePrompt } from "@phoenix/store";
import type { EvaluatorInputMapping } from "@phoenix/types";

import type { useEvaluatorSlotSaveAttachCodeMutation } from "./__generated__/useEvaluatorSlotSaveAttachCodeMutation.graphql";
import type { useEvaluatorSlotSaveCodeVersionMutation } from "./__generated__/useEvaluatorSlotSaveCodeVersionMutation.graphql";
import type { useEvaluatorSlotSaveCreateCodeMutation } from "./__generated__/useEvaluatorSlotSaveCreateCodeMutation.graphql";
import type { useEvaluatorSlotSaveCreateLLMMutation } from "./__generated__/useEvaluatorSlotSaveCreateLLMMutation.graphql";
import type { useEvaluatorSlotSaveNamesQuery } from "./__generated__/useEvaluatorSlotSaveNamesQuery.graphql";
import type { useEvaluatorSlotSavePatchCodeMutation } from "./__generated__/useEvaluatorSlotSavePatchCodeMutation.graphql";
import type { useEvaluatorSlotSaveUpdateCodeMutation } from "./__generated__/useEvaluatorSlotSaveUpdateCodeMutation.graphql";
import type { useEvaluatorSlotSaveUpdateLLMMutation } from "./__generated__/useEvaluatorSlotSaveUpdateLLMMutation.graphql";
import { getEvaluatorCopyName } from "./evaluatorCopyName";
import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";

export type SaveEvaluatorSlotRequest = {
  target: EvaluatorSaveTarget;
  datasetId: string;
  name: string;
  description: string | undefined;
  inputMapping: EvaluatorInputMapping;
  /** The slot's run payload; it already carries the prompt or the code. */
  preview: EvaluatorPreviewInput;
  /**
   * The prompt version the LLM slot was loaded from. The server appends a new
   * version to that prompt only when the content changed; without it, every
   * save would mint a fresh prompt.
   */
  promptVersionId: string | null;
  sandboxConfigId: string | null;
  /** The sandbox the code slot was loaded with, to rebind only on change. */
  initialSandboxConfigId: string | null;
};

export type SavedEvaluatorSlot = {
  datasetEvaluatorId: string;
  /** Whether Save created a dataset evaluator or changed the one loaded. */
  action: "created" | "updated";
  /** The prompt an updated LLM evaluator now points at. */
  prompt: PlaygroundInstancePrompt | null;
};

/**
 * Saves a slot's draft the way the prompt playground saves a prompt: an
 * evaluator already on the dataset is updated in place, anything else becomes
 * a new dataset evaluator. Rejects with an Error carrying the server message.
 */
export function useEvaluatorSlotSave() {
  const environment = useRelayEnvironment();
  const [isSaving, setIsSaving] = useState(false);

  async function save(
    request: SaveEvaluatorSlotRequest
  ): Promise<SavedEvaluatorSlot> {
    setIsSaving(true);

    try {
      return request.preview.inlineLlmEvaluator
        ? await saveLLM(environment, request)
        : await saveCode(environment, request);
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * A name for a copy of `base` that no evaluator, and no evaluator on the
   * dataset, already uses. Both must be free: the shared evaluator's name is
   * unique across evaluators, the binding's within its dataset.
   */
  async function copyName(base: string, datasetId: string): Promise<string> {
    const data = await fetchQuery<useEvaluatorSlotSaveNamesQuery>(
      environment,
      namesQuery,
      { filter: { col: "name", value: `${base.trim()}_copy` } }
    ).toPromise();

    const taken = (data?.evaluators.edges ?? []).flatMap(({ node }) => [
      node.name,
      ...node.datasetEvaluators
        .filter((binding) => binding.dataset.id === datasetId)
        .map((binding) => binding.name),
    ]);

    return getEvaluatorCopyName(base, taken);
  }

  return { save, copyName, isSaving };
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
    datasetId: request.datasetId,
    inputMapping: request.inputMapping,
    promptVersion: llm.promptVersion,
    promptVersionId: request.promptVersionId,
    outputConfigs: llm.outputConfigs,
  };

  if (target.action === "update") {
    const response = await commit<useEvaluatorSlotSaveUpdateLLMMutation>(
      environment,
      updateLLMMutation,
      { input: { ...input, datasetEvaluatorId: target.datasetEvaluatorId } }
    );

    const { id, evaluator } = response.updateDatasetLlmEvaluator.evaluator;

    return {
      datasetEvaluatorId: id,
      action: "updated",
      prompt:
        evaluator.prompt && evaluator.promptVersion
          ? {
              id: evaluator.prompt.id,
              name: evaluator.prompt.name,
              version: evaluator.promptVersion.id,
              tag: evaluator.promptVersionTag?.name ?? null,
            }
          : null,
    };
  }

  const response = await commit<useEvaluatorSlotSaveCreateLLMMutation>(
    environment,
    createLLMMutation,
    { input }
  );

  return {
    datasetEvaluatorId: response.createDatasetLlmEvaluator.evaluator.id,
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
    datasetId: request.datasetId,
    name: request.name,
    description: request.description,
    inputMapping: request.inputMapping,
    outputConfigs: code.outputConfigs,
  };

  if (target.action === "create") {
    const created = await commit<useEvaluatorSlotSaveCreateCodeMutation>(
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

  // Sandbox rebinding lives on patchCodeEvaluator; a version row carries no
  // sandbox. Rebinding validates the source in the sandbox, so only on change.
  await commit<useEvaluatorSlotSavePatchCodeMutation>(
    environment,
    patchCodeMutation,
    {
      input: {
        id: target.evaluatorId,
        name: request.name,
        description: request.description,
        inputMapping: request.inputMapping,
        outputConfigs: code.outputConfigs,
        ...(request.sandboxConfigId !== request.initialSandboxConfigId
          ? { sandboxConfigId: request.sandboxConfigId }
          : {}),
      },
    }
  );
  // The server skips the version when the source matches the current tip.
  await commit<useEvaluatorSlotSaveCodeVersionMutation>(
    environment,
    codeVersionMutation,
    {
      input: {
        codeEvaluatorId: target.evaluatorId,
        sourceCode: code.sourceCode,
      },
    }
  );

  if (target.action === "attach")
    return attachCode(environment, {
      ...binding,
      evaluatorId: target.evaluatorId,
    });

  const response = await commit<useEvaluatorSlotSaveUpdateCodeMutation>(
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
    datasetEvaluatorId: response.updateDatasetCodeEvaluator.evaluator.id,
    action: "updated",
    prompt: null,
  };
}

async function attachCode(
  environment: Environment,
  input: useEvaluatorSlotSaveAttachCodeMutation["variables"]["input"]
): Promise<SavedEvaluatorSlot> {
  const response = await commit<useEvaluatorSlotSaveAttachCodeMutation>(
    environment,
    attachCodeMutation,
    { input }
  );

  return {
    datasetEvaluatorId: response.createDatasetCodeEvaluator.evaluator.id,
    action: "created",
    prompt: null,
  };
}

/** Relay's callback API as a promise; GraphQL errors reject like network ones. */
function commit<T extends MutationParameters>(
  environment: Environment,
  mutation: GraphQLTaggedNode,
  variables: T["variables"]
): Promise<T["response"]> {
  return new Promise((resolve, reject) => {
    commitMutation<T>(environment, {
      mutation,
      variables,
      onCompleted: (response, errors) => {
        const messages = errors?.map((error) => error.message) ?? [];

        if (messages.length) reject(new Error(messages.join("\n")));
        else resolve(response);
      },
      onError: reject,
    });
  });
}

const namesQuery = graphql`
  query useEvaluatorSlotSaveNamesQuery($filter: EvaluatorFilter!) {
    evaluators(first: 200, filter: $filter) {
      edges {
        node {
          name
          datasetEvaluators {
            name
            dataset {
              id
            }
          }
        }
      }
    }
  }
`;

const createLLMMutation = graphql`
  mutation useEvaluatorSlotSaveCreateLLMMutation(
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
  mutation useEvaluatorSlotSaveUpdateLLMMutation(
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
  mutation useEvaluatorSlotSaveCreateCodeMutation(
    $input: CreateCodeEvaluatorInput!
  ) {
    createCodeEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

const patchCodeMutation = graphql`
  mutation useEvaluatorSlotSavePatchCodeMutation(
    $input: PatchCodeEvaluatorInput!
  ) {
    patchCodeEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

const codeVersionMutation = graphql`
  mutation useEvaluatorSlotSaveCodeVersionMutation(
    $input: CreateCodeEvaluatorVersionInput!
  ) {
    createCodeEvaluatorVersion(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

const attachCodeMutation = graphql`
  mutation useEvaluatorSlotSaveAttachCodeMutation(
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
  mutation useEvaluatorSlotSaveUpdateCodeMutation(
    $input: UpdateDatasetCodeEvaluatorInput!
  ) {
    updateDatasetCodeEvaluator(input: $input) {
      evaluator {
        ...EvaluatorSlot_datasetEvaluator @relay(mask: false)
      }
    }
  }
`;
