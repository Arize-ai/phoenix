import { commitMutation, graphql } from "react-relay";
import type { GraphQLTaggedNode } from "relay-runtime";

import type { PromptSnapshot } from "@phoenix/agent/tools/playgroundPrompt";
import { getPromptSnapshot } from "@phoenix/agent/tools/playgroundPrompt/promptStore";
import {
  getInstancePromptParamsFromStore,
  toPromptVersionTagInputs,
} from "@phoenix/pages/playground/playgroundPromptUtils";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import { getIdentifier } from "@phoenix/utils/identifierUtils";

import type {
  savePlaygroundPromptCreateMutation,
  CreateChatPromptInput,
} from "./__generated__/savePlaygroundPromptCreateMutation.graphql";
import type {
  savePlaygroundPromptCreateVersionMutation,
  CreateChatPromptVersionInput,
} from "./__generated__/savePlaygroundPromptCreateVersionMutation.graphql";
import type {
  CreatePromptResponse,
  CreatePromptVersionResponse,
  SavePlaygroundPromptParams,
  SavePlaygroundPromptPreviewParams,
  SavePromptMode,
  SavePromptMutationCommitter,
  SavePromptMutationInput,
  SavePromptMutationResult,
  SavePromptOutput,
  SavePromptPreview,
} from "./types";

const DEFAULT_PROMPT_NAME = "playground_prompt";
const MAX_GENERATED_PROMPT_NAME_BASE_LENGTH = 72;

type SavePromptResult =
  | { ok: true; output: SavePromptOutput }
  | { ok: false; error: string };

type SavePromptPreviewResult =
  | { ok: true; output: SavePromptPreview }
  | { ok: false; error: string };

const createPromptMutation = graphql`
  mutation savePlaygroundPromptCreateMutation($input: CreateChatPromptInput!) {
    createChatPrompt(input: $input) {
      id
      name
      version {
        id
      }
    }
  }
`;

const createPromptVersionMutation = graphql`
  mutation savePlaygroundPromptCreateVersionMutation(
    $input: CreateChatPromptVersionInput!
  ) {
    createChatPromptVersion(input: $input) {
      id
      name
      version {
        id
      }
    }
  }
`;

function getGraphQLMutationErrorMessage(
  errors: readonly { message: string }[] | null | undefined
) {
  return errors?.find((error) => error.message)?.message ?? null;
}

function toSavePromptMutationResult(
  response: CreatePromptResponse | CreatePromptVersionResponse
): SavePromptMutationResult {
  return {
    promptId: response.id,
    promptName: response.name,
    promptVersionId: response.version.id,
  };
}

function commitCreatePrompt(
  input: CreateChatPromptInput
): Promise<SavePromptMutationResult> {
  return new Promise((resolve, reject) => {
    commitMutation<savePlaygroundPromptCreateMutation>(RelayEnvironment, {
      mutation: createPromptMutation as GraphQLTaggedNode,
      variables: { input },
      onCompleted: (response, errors) => {
        const message = getGraphQLMutationErrorMessage(errors);
        if (message) {
          reject(new Error(message));
          return;
        }
        resolve(toSavePromptMutationResult(response.createChatPrompt));
      },
      onError: reject,
    });
  });
}

function commitCreatePromptVersion(
  input: CreateChatPromptVersionInput
): Promise<SavePromptMutationResult> {
  return new Promise((resolve, reject) => {
    commitMutation<savePlaygroundPromptCreateVersionMutation>(
      RelayEnvironment,
      {
        mutation: createPromptVersionMutation as GraphQLTaggedNode,
        variables: { input },
        onCompleted: (response, errors) => {
          const message = getGraphQLMutationErrorMessage(errors);
          if (message) {
            reject(new Error(message));
            return;
          }
          resolve(toSavePromptMutationResult(response.createChatPromptVersion));
        },
        onError: reject,
      }
    );
  });
}

export const commitSavePromptMutation: SavePromptMutationCommitter = (
  mutation
) => {
  if (mutation.mode === "create") {
    return commitCreatePrompt(mutation.input);
  }
  return commitCreatePromptVersion(mutation.input);
};

function getMutationFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to save prompt.";
}

function getTagsForSave({
  requestedTags,
}: {
  requestedTags: readonly string[] | undefined;
}) {
  return requestedTags ?? [];
}

function getFirstContentLine(content: string | undefined): string | null {
  if (!content) {
    return null;
  }
  return (
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}

function getPromptNameSource(snapshot: PromptSnapshot): string {
  const systemMessage = snapshot.messages.find(
    (message) => message.role === "system"
  );
  const firstMessageWithContent = snapshot.messages.find((message) =>
    Boolean(message.content?.trim())
  );
  return (
    getFirstContentLine(systemMessage?.content) ??
    getFirstContentLine(firstMessageWithContent?.content) ??
    DEFAULT_PROMPT_NAME
  );
}

function cleanPromptNameSource(source: string): string {
  return source
    .replace(/^#+\s*/, "")
    .replace(/^you are an?\s+/i, "")
    .replace(/^your job is to\s+/i, "")
    .replace(/\bprompt\b$/i, "")
    .replace(/[.!?:;]+$/g, "")
    .trim();
}

function getGeneratedPromptName(snapshot: PromptSnapshot): string {
  const source = cleanPromptNameSource(getPromptNameSource(snapshot));
  const baseIdentifier = getIdentifier(source) || DEFAULT_PROMPT_NAME;
  const truncatedBaseIdentifier =
    getIdentifier(
      baseIdentifier.slice(0, MAX_GENERATED_PROMPT_NAME_BASE_LENGTH)
    ) || DEFAULT_PROMPT_NAME;
  return `${truncatedBaseIdentifier}_${snapshot.instanceId}`;
}

/**
 * Resolves the prompt name for a create. A user/agent-supplied name is a
 * human-readable string (e.g. "Customer Escalation Router"), but the backend
 * `name` is an identifier (`^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$`), so it must be
 * slugified the same way generated names are. Falls back to a name derived
 * from the prompt content when no name is given or it slugifies to empty.
 */
function getCreatePromptName(
  requestedName: string | undefined,
  snapshot: PromptSnapshot
): string {
  if (requestedName != null) {
    const identifier = getIdentifier(requestedName);
    if (identifier) {
      return identifier;
    }
  }
  return getGeneratedPromptName(snapshot);
}

/**
 * Builds the effective save target and metadata that will be used if the user
 * approves the save_prompt call.
 */
export function getSavePromptPreview({
  playgroundStore,
  input,
}: SavePlaygroundPromptPreviewParams): SavePromptPreviewResult {
  const snapshot = getPromptSnapshot({
    playgroundStore,
    instanceId: input.instanceId,
  });
  if (!snapshot.ok) {
    return snapshot;
  }

  const state = playgroundStore.getState();
  const instance = state.instances.find(
    (candidate) => candidate.id === snapshot.output.instanceId
  );
  if (!instance) {
    return {
      ok: false,
      error: `Playground instance ${snapshot.output.instanceId} was not found.`,
    };
  }

  const shouldCreatePrompt = input.promptId == null && input.name != null;
  const promptId =
    input.promptId ??
    (shouldCreatePrompt ? null : (instance.prompt?.id ?? null));
  const mode: SavePromptMode = promptId ? "update" : "create";
  const promptName =
    mode === "update"
      ? (input.name ?? instance.prompt?.name ?? "Selected prompt")
      : getCreatePromptName(input.name, snapshot.output);

  return {
    ok: true,
    output: {
      mode,
      instanceId: snapshot.output.instanceId,
      label: snapshot.output.label,
      promptId,
      promptName,
      description: input.description,
      tags: [...getTagsForSave({ requestedTags: input.tags })],
      dirtyBeforeSave: snapshot.output.dirty,
    },
  };
}

/**
 * Saves the current playground instance by creating either a new Prompt or a
 * new PromptVersion. The active browser state is converted through the same
 * prompt-version serializer used by the Save Prompt dialog.
 */
export async function savePlaygroundPrompt({
  playgroundStore,
  input,
  commitPrompt = commitSavePromptMutation,
}: SavePlaygroundPromptParams): Promise<SavePromptResult> {
  const preview = getSavePromptPreview({
    playgroundStore,
    input,
  });
  if (!preview.ok) {
    return preview;
  }

  let promptParams: ReturnType<typeof getInstancePromptParamsFromStore>;
  try {
    promptParams = getInstancePromptParamsFromStore(
      preview.output.instanceId,
      playgroundStore
    );
  } catch (error) {
    return {
      ok: false,
      error: getMutationFailureMessage(error),
    };
  }

  const { promptId, promptName, tags } = preview.output;
  const tagInputs = toPromptVersionTagInputs(tags);
  try {
    const saveMutation: SavePromptMutationInput = promptId
      ? {
          mode: "update",
          input: {
            promptId,
            promptVersion: {
              ...promptParams.promptInput,
              description: input.description,
            },
            tags: tagInputs,
          },
        }
      : {
          mode: "create",
          input: {
            name: promptName,
            description: input.description,
            promptVersion: promptParams.promptInput,
            tags: tagInputs,
          },
        };
    const result = await commitPrompt(saveMutation);

    const state = playgroundStore.getState();
    state.updateInstance({
      instanceId: preview.output.instanceId,
      patch: {
        prompt: {
          id: result.promptId,
          name: result.promptName,
          version: result.promptVersionId,
          tag: tags[0] ?? null,
        },
      },
      dirty: false,
    });

    return {
      ok: true,
      output: {
        status: "saved",
        mode: saveMutation.mode,
        instanceId: preview.output.instanceId,
        label: preview.output.label,
        promptId: result.promptId,
        promptName: result.promptName,
        promptVersionId: result.promptVersionId,
        tag: tags[0] ?? null,
        dirtyBeforeSave: preview.output.dirtyBeforeSave,
        message:
          saveMutation.mode === "create"
            ? "Prompt created from playground instance."
            : "Prompt version saved from playground instance.",
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: getMutationFailureMessage(error),
    };
  }
}
