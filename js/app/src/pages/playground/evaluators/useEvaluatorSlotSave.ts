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

import type { useEvaluatorSlotSaveAddProjectCodeMutation } from "./__generated__/useEvaluatorSlotSaveAddProjectCodeMutation.graphql";
import type { useEvaluatorSlotSaveAttachCodeMutation } from "./__generated__/useEvaluatorSlotSaveAttachCodeMutation.graphql";
import type { useEvaluatorSlotSaveCodeVersionMutation } from "./__generated__/useEvaluatorSlotSaveCodeVersionMutation.graphql";
import type { useEvaluatorSlotSaveCreateCodeMutation } from "./__generated__/useEvaluatorSlotSaveCreateCodeMutation.graphql";
import type { useEvaluatorSlotSaveCreateLLMMutation } from "./__generated__/useEvaluatorSlotSaveCreateLLMMutation.graphql";
import type { useEvaluatorSlotSaveCreateProjectCodeMutation } from "./__generated__/useEvaluatorSlotSaveCreateProjectCodeMutation.graphql";
import type { useEvaluatorSlotSaveCreateProjectLLMMutation } from "./__generated__/useEvaluatorSlotSaveCreateProjectLLMMutation.graphql";
import type { useEvaluatorSlotSaveNamesQuery } from "./__generated__/useEvaluatorSlotSaveNamesQuery.graphql";
import type { useEvaluatorSlotSavePatchCodeMutation } from "./__generated__/useEvaluatorSlotSavePatchCodeMutation.graphql";
import type { useEvaluatorSlotSaveProjectNamesQuery } from "./__generated__/useEvaluatorSlotSaveProjectNamesQuery.graphql";
import type { useEvaluatorSlotSaveUpdateCodeMutation } from "./__generated__/useEvaluatorSlotSaveUpdateCodeMutation.graphql";
import type { useEvaluatorSlotSaveUpdateLLMMutation } from "./__generated__/useEvaluatorSlotSaveUpdateLLMMutation.graphql";
import type { useEvaluatorSlotSaveUpdateProjectCodeMutation } from "./__generated__/useEvaluatorSlotSaveUpdateProjectCodeMutation.graphql";
import type { useEvaluatorSlotSaveUpdateProjectLLMMutation } from "./__generated__/useEvaluatorSlotSaveUpdateProjectLLMMutation.graphql";
import { getEvaluatorCopyName } from "./evaluatorCopyName";
import type { EvaluatorSlotSource } from "./evaluatorPlaygroundSource";
import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";
import { isProjectEvaluatorUpdate } from "./evaluatorSaveTarget";

/** Span target only in this PR; trace and session targets would branch here. */
const PROJECT_EVALUATION_TARGET = "SPAN" as const;

/** What a project evaluator stores beyond the evaluator itself. */
export type ProjectEvaluatorScopeInput = {
  filterCondition: string;
  /** A fraction in [0, 1]. */
  samplingRate: number;
};

export type SaveEvaluatorSlotRequest = {
  target: EvaluatorSaveTarget;
  source: EvaluatorSlotSource;
  /** Required for a project source; ignored for a dataset. */
  projectScope?: ProjectEvaluatorScopeInput;
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
  /** The dataset evaluator or project evaluator Save left the slot pointing at. */
  bindingId: string;
  bindingKind: EvaluatorSlotSource["kind"];
  /** Whether Save created a binding or changed the one loaded. */
  action: "created" | "updated";
  /** The prompt an updated LLM evaluator now points at. */
  prompt: PlaygroundInstancePrompt | null;
};

/**
 * Saves a slot's draft the way the prompt playground saves a prompt: an
 * evaluator already on the dataset or project is updated in place, anything
 * else becomes a new dataset or project evaluator. Rejects with an Error
 * carrying the server message.
 */
export function useEvaluatorSlotSave() {
  const environment = useRelayEnvironment();
  const [isSaving, setIsSaving] = useState(false);

  async function save(
    request: SaveEvaluatorSlotRequest
  ): Promise<SavedEvaluatorSlot> {
    setIsSaving(true);

    try {
      if (request.source.kind === "project")
        return request.preview.inlineLlmEvaluator
          ? await saveProjectLLM(environment, request)
          : await saveProjectCode(environment, request);

      return request.preview.inlineLlmEvaluator
        ? await saveLLM(environment, request)
        : await saveCode(environment, request);
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * A name for a copy of `base` that no evaluator, and no evaluator on the
   * dataset or project, already uses. Both must be free: the shared
   * evaluator's name is unique across evaluators, the binding's within its
   * dataset or project.
   */
  async function copyName(
    base: string,
    source: EvaluatorSlotSource
  ): Promise<string> {
    const filter = { col: "name" as const, value: `${base.trim()}_copy` };

    if (source.kind === "project") {
      const data = await fetchQuery<useEvaluatorSlotSaveProjectNamesQuery>(
        environment,
        projectNamesQuery,
        { filter, projectFilter: filter, projectId: source.projectId }
      ).toPromise();

      return getEvaluatorCopyName(base, [
        ...(data?.evaluators.edges ?? []).map(({ node }) => node.name),
        ...(data?.project?.evaluators?.edges ?? []).map(
          ({ node }) => node.name
        ),
      ]);
    }

    const data = await fetchQuery<useEvaluatorSlotSaveNamesQuery>(
      environment,
      namesQuery,
      { filter }
    ).toPromise();

    const taken = (data?.evaluators.edges ?? []).flatMap(({ node }) => [
      node.name,
      ...node.datasetEvaluators
        .filter((binding) => binding.dataset.id === source.datasetId)
        .map((binding) => binding.name),
    ]);

    return getEvaluatorCopyName(base, taken);
  }

  return { save, copyName, isSaving };
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
      await commitEvaluatorMutation<useEvaluatorSlotSaveUpdateLLMMutation>(
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
    await commitEvaluatorMutation<useEvaluatorSlotSaveCreateLLMMutation>(
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
      await commitEvaluatorMutation<useEvaluatorSlotSaveCreateCodeMutation>(
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

  await updateSharedCode(environment, request, target.evaluatorId);

  if (target.action === "attach")
    return attachCode(environment, {
      ...binding,
      evaluatorId: target.evaluatorId,
    });

  if (!("datasetEvaluatorId" in target))
    throw new Error("Select a dataset before saving a dataset evaluator.");

  const response =
    await commitEvaluatorMutation<useEvaluatorSlotSaveUpdateCodeMutation>(
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

/**
 * Sandbox rebinding lives on patchCodeEvaluator; a version row carries no
 * sandbox. Rebinding validates the source in the sandbox, so only on change.
 * The server skips the version when the source matches the current tip.
 */
async function updateSharedCode(
  environment: Environment,
  request: SaveEvaluatorSlotRequest,
  evaluatorId: string
) {
  const code = request.preview.inlineCodeEvaluator;

  if (!code) return;
  await commitEvaluatorMutation<useEvaluatorSlotSavePatchCodeMutation>(
    environment,
    patchCodeMutation,
    {
      input: {
        id: evaluatorId,
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
  await commitEvaluatorMutation<useEvaluatorSlotSaveCodeVersionMutation>(
    environment,
    codeVersionMutation,
    { input: { codeEvaluatorId: evaluatorId, sourceCode: code.sourceCode } }
  );
}

async function attachCode(
  environment: Environment,
  input: useEvaluatorSlotSaveAttachCodeMutation["variables"]["input"]
): Promise<SavedEvaluatorSlot> {
  const response =
    await commitEvaluatorMutation<useEvaluatorSlotSaveAttachCodeMutation>(
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

function getProjectScope(request: SaveEvaluatorSlotRequest) {
  if (request.source.kind !== "project" || !request.projectScope)
    throw new Error("Select a project before saving a project evaluator.");

  return {
    projectId: request.source.projectId,
    filterCondition: request.projectScope.filterCondition,
    samplingRate: request.projectScope.samplingRate,
    evaluationTarget: PROJECT_EVALUATION_TARGET,
  };
}

async function saveProjectLLM(
  environment: Environment,
  request: SaveEvaluatorSlotRequest
): Promise<SavedEvaluatorSlot> {
  const { target } = request;
  const llm = request.preview.inlineLlmEvaluator;

  if (!llm?.promptVersion || !llm.outputConfigs)
    throw new Error("Complete the evaluator configuration before saving.");
  const { projectId, ...scope } = getProjectScope(request);

  const input = {
    ...scope,
    name: request.name,
    description: request.description,
    inputMapping: request.inputMapping,
    promptVersion: llm.promptVersion,
    promptVersionId: request.promptVersionId,
    outputConfigs: llm.outputConfigs,
  };

  if (isProjectEvaluatorUpdate(target)) {
    const response =
      await commitEvaluatorMutation<useEvaluatorSlotSaveUpdateProjectLLMMutation>(
        environment,
        updateProjectLLMMutation,
        { input: { ...input, projectEvaluatorId: target.projectEvaluatorId } }
      );

    const { id, evaluator } = response.updateProjectLlmEvaluator.evaluator;

    return {
      bindingId: id,
      bindingKind: "project",
      action: "updated",
      prompt: toSavedPrompt(evaluator),
    };
  }

  const response =
    await commitEvaluatorMutation<useEvaluatorSlotSaveCreateProjectLLMMutation>(
      environment,
      createProjectLLMMutation,
      { input: { ...input, projectId } }
    );

  return {
    bindingId: response.createProjectLlmEvaluator.evaluator.id,
    bindingKind: "project",
    action: "created",
    prompt: null,
  };
}

async function saveProjectCode(
  environment: Environment,
  request: SaveEvaluatorSlotRequest
): Promise<SavedEvaluatorSlot> {
  const { target } = request;
  const code = request.preview.inlineCodeEvaluator;

  if (!code || !request.sandboxConfigId)
    throw new Error("Select a sandbox before saving a code evaluator.");
  const { projectId, ...scope } = getProjectScope(request);

  if (target.action === "create") {
    const response =
      await commitEvaluatorMutation<useEvaluatorSlotSaveCreateProjectCodeMutation>(
        environment,
        createProjectCodeMutation,
        {
          input: {
            ...scope,
            projectId,
            name: request.name,
            description: request.description,
            sourceCode: code.sourceCode,
            language: code.language,
            sandboxConfigId: request.sandboxConfigId,
            outputConfigs: code.outputConfigs,
            evaluatorInputMapping: request.inputMapping,
            inputMapping: null,
          },
        }
      );

    return {
      bindingId: response.createProjectCodeEvaluator.evaluator.id,
      bindingKind: "project",
      action: "created",
      prompt: null,
    };
  }

  if (target.action === "attach") {
    await updateSharedCode(environment, request, target.evaluatorId);

    const response =
      await commitEvaluatorMutation<useEvaluatorSlotSaveAddProjectCodeMutation>(
        environment,
        addProjectCodeMutation,
        {
          input: {
            ...scope,
            projectId,
            evaluatorId: target.evaluatorId,
            name: request.name,
            inputMapping: request.inputMapping,
          },
        }
      );

    return {
      bindingId: response.addProjectCodeEvaluator.evaluator.id,
      bindingKind: "project",
      action: "created",
      prompt: null,
    };
  }

  if (!isProjectEvaluatorUpdate(target))
    throw new Error("Select a project before saving a project evaluator.");

  // The project update carries the code itself, unlike the dataset one, so
  // the shared evaluator and the binding change in a single mutation.
  const response =
    await commitEvaluatorMutation<useEvaluatorSlotSaveUpdateProjectCodeMutation>(
      environment,
      updateProjectCodeMutation,
      {
        input: {
          ...scope,
          projectEvaluatorId: target.projectEvaluatorId,
          name: request.name,
          description: request.description ?? null,
          sourceCode: code.sourceCode,
          outputConfigs: code.outputConfigs,
          inputMapping: request.inputMapping,
          ...(request.sandboxConfigId !== request.initialSandboxConfigId
            ? { sandboxConfigId: request.sandboxConfigId }
            : {}),
        },
      }
    );

  return {
    bindingId: response.updateProjectCodeEvaluator.evaluator.id,
    bindingKind: "project",
    action: "updated",
    prompt: null,
  };
}

function toSavedPrompt(evaluator: {
  readonly prompt?: { readonly id: string; readonly name: string } | null;
  readonly promptVersion?: { readonly id: string } | null;
  readonly promptVersionTag?: { readonly name: string } | null;
}): PlaygroundInstancePrompt | null {
  return evaluator.prompt && evaluator.promptVersion
    ? {
        id: evaluator.prompt.id,
        name: evaluator.prompt.name,
        version: evaluator.promptVersion.id,
        tag: evaluator.promptVersionTag?.name ?? null,
      }
    : null;
}

/** Relay's callback API as a promise; GraphQL errors reject like network ones. */
export function commitEvaluatorMutation<T extends MutationParameters>(
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

const projectNamesQuery = graphql`
  query useEvaluatorSlotSaveProjectNamesQuery(
    $filter: EvaluatorFilter!
    $projectFilter: ProjectEvaluatorFilter!
    $projectId: ID!
  ) {
    evaluators(first: 200, filter: $filter) {
      edges {
        node {
          name
        }
      }
    }
    project: node(id: $projectId) {
      ... on Project {
        evaluators(first: 200, filter: $projectFilter) {
          edges {
            node {
              name
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

const createProjectLLMMutation = graphql`
  mutation useEvaluatorSlotSaveCreateProjectLLMMutation(
    $input: CreateProjectLLMEvaluatorInput!
  ) {
    createProjectLlmEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

const updateProjectLLMMutation = graphql`
  mutation useEvaluatorSlotSaveUpdateProjectLLMMutation(
    $input: UpdateProjectLLMEvaluatorInput!
  ) {
    updateProjectLlmEvaluator(input: $input) {
      evaluator {
        ...EvaluatorSlot_projectEvaluator @relay(mask: false)
      }
    }
  }
`;

const createProjectCodeMutation = graphql`
  mutation useEvaluatorSlotSaveCreateProjectCodeMutation(
    $input: CreateProjectCodeEvaluatorInput!
  ) {
    createProjectCodeEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

const addProjectCodeMutation = graphql`
  mutation useEvaluatorSlotSaveAddProjectCodeMutation(
    $input: AddProjectCodeEvaluatorInput!
  ) {
    addProjectCodeEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

const updateProjectCodeMutation = graphql`
  mutation useEvaluatorSlotSaveUpdateProjectCodeMutation(
    $input: UpdateProjectCodeEvaluatorInput!
  ) {
    updateProjectCodeEvaluator(input: $input) {
      evaluator {
        ...EvaluatorSlot_projectEvaluator @relay(mask: false)
      }
    }
  }
`;
