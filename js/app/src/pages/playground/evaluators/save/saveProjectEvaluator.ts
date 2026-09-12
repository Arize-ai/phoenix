import { graphql } from "react-relay";
import type { Environment } from "relay-runtime";

import { isProjectEvaluatorUpdate } from "../evaluatorSaveTarget";
import type { saveProjectEvaluatorAddProjectCodeMutation } from "./__generated__/saveProjectEvaluatorAddProjectCodeMutation.graphql";
import type { saveProjectEvaluatorCreateProjectCodeMutation } from "./__generated__/saveProjectEvaluatorCreateProjectCodeMutation.graphql";
import type { saveProjectEvaluatorCreateProjectLLMMutation } from "./__generated__/saveProjectEvaluatorCreateProjectLLMMutation.graphql";
import type { saveProjectEvaluatorUpdateProjectCodeMutation } from "./__generated__/saveProjectEvaluatorUpdateProjectCodeMutation.graphql";
import type { saveProjectEvaluatorUpdateProjectLLMMutation } from "./__generated__/saveProjectEvaluatorUpdateProjectLLMMutation.graphql";
import { commitEvaluatorMutation } from "./commitEvaluatorMutation";
import { updateSharedCodeEvaluator } from "./saveCodeEvaluatorSource";
import type { SaveEvaluatorSlotRequest, SavedEvaluatorSlot } from "./types";
import { toSavedPrompt } from "./types";

/**
 * Saves a slot to a project as an online evaluator. The evaluation target
 * comes from the request's scope: a loaded SPAN evaluator's, or SPAN for a
 * new one, since the slot refuses to load trace and session evaluators.
 */
export function saveProjectEvaluator(
  environment: Environment,
  request: SaveEvaluatorSlotRequest
): Promise<SavedEvaluatorSlot> {
  return request.preview.inlineLlmEvaluator
    ? saveProjectLLM(environment, request)
    : saveProjectCode(environment, request);
}

/** The project and the scope the saved evaluator runs with, as mutation input. */
function getProjectScope(request: SaveEvaluatorSlotRequest) {
  if (request.source.kind !== "project" || !request.projectScope)
    throw new Error("Select a project before saving a project evaluator.");

  return {
    projectId: request.source.projectId,
    filterCondition: request.projectScope.filterCondition,
    samplingRate: request.projectScope.samplingRate,
    evaluationTarget: request.projectScope.evaluationTarget,
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
      await commitEvaluatorMutation<saveProjectEvaluatorUpdateProjectLLMMutation>(
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
    await commitEvaluatorMutation<saveProjectEvaluatorCreateProjectLLMMutation>(
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

/**
 * As on a dataset, the slot's mapping is written to the shared code evaluator
 * (`evaluatorInputMapping`, or the patch in `updateSharedCodeEvaluator`) and
 * the project binding inherits it (`inputMapping: null`) instead of keeping a
 * project-specific override that would drift from the evaluator.
 */
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
      await commitEvaluatorMutation<saveProjectEvaluatorCreateProjectCodeMutation>(
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
    await updateSharedCodeEvaluator(environment, request, target.evaluatorId);

    const response =
      await commitEvaluatorMutation<saveProjectEvaluatorAddProjectCodeMutation>(
        environment,
        addProjectCodeMutation,
        {
          input: {
            ...scope,
            projectId,
            evaluatorId: target.evaluatorId,
            name: request.name,
            inputMapping: null,
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
    await commitEvaluatorMutation<saveProjectEvaluatorUpdateProjectCodeMutation>(
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
          evaluatorInputMapping: request.inputMapping,
          inputMapping: null,
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

const createProjectLLMMutation = graphql`
  mutation saveProjectEvaluatorCreateProjectLLMMutation(
    $input: CreateProjectLLMEvaluatorInput!
  ) {
    createProjectLlmEvaluator(input: $input) {
      evaluator {
        id
      }
    }
  }
`;

// Updates return the slot source's shape so a later reload of the same
// evaluator reads fresh data from the Relay store.
const updateProjectLLMMutation = graphql`
  mutation saveProjectEvaluatorUpdateProjectLLMMutation(
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
  mutation saveProjectEvaluatorCreateProjectCodeMutation(
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
  mutation saveProjectEvaluatorAddProjectCodeMutation(
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
  mutation saveProjectEvaluatorUpdateProjectCodeMutation(
    $input: UpdateProjectCodeEvaluatorInput!
  ) {
    updateProjectCodeEvaluator(input: $input) {
      evaluator {
        ...EvaluatorSlot_projectEvaluator @relay(mask: false)
      }
    }
  }
`;
