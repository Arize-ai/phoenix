import { NUM_MAX_PLAYGROUND_INSTANCES } from "@phoenix/pages/playground/constants";
import type {
  ChatMessage,
  PlaygroundNormalizedInstance,
} from "@phoenix/store/playground";
import {
  createNormalizedPlaygroundInstance,
  generateInstanceId,
  generateMessageId,
  type PlaygroundStore,
} from "@phoenix/store/playground";

import { parsePromptMessageRole } from "./roles";
import type {
  EditPromptOperation,
  MaterializedEditPromptOperation,
  PromptActionResult,
  PromptMessageSnapshot,
  PromptSnapshot,
} from "./types";

/**
 * Returns a snapshot of a playground prompt instance's current state.
 * If only one instance exists, it is selected automatically; otherwise
 * instanceId must be provided.
 */
export function getPromptSnapshot({
  playgroundStore,
  instanceId,
}: {
  playgroundStore: PlaygroundStore;
  instanceId?: number;
}): PromptActionResult<PromptSnapshot> {
  const state = playgroundStore.getState();
  const instances = state.instances;
  const resolvedInstanceId =
    instanceId ?? (instances.length === 1 ? instances[0]?.id : undefined);
  if (resolvedInstanceId == null) {
    return {
      ok: false,
      error: `Multiple playground instances are available. Pass one of these instance IDs: ${instances
        .map((instance) => instance.id)
        .join(", ")}.`,
    };
  }
  const instance = instances.find(
    (candidate) => candidate.id === resolvedInstanceId
  );
  if (!instance) {
    return {
      ok: false,
      error: `Playground instance ${resolvedInstanceId} was not found.`,
    };
  }
  if (instance.template.__type !== "chat") {
    return {
      ok: false,
      error: "Only chat playground prompts can be read or edited.",
    };
  }
  const maybeMessages = instance.template.messageIds.map((messageId) => {
    const message = state.allInstanceMessages[messageId];
    return normalizeMessageSnapshot(message);
  });
  const messages = maybeMessages.filter(
    (message): message is PromptMessageSnapshot => message != null
  );
  if (messages.length !== maybeMessages.length) {
    return {
      ok: false,
      error: "The playground prompt has missing message state.",
    };
  }
  const instanceIndex = instances.findIndex(
    (candidate) => candidate.id === instance.id
  );
  const snapshotWithoutRevision = {
    instanceId: instance.id,
    index: instanceIndex,
    label: getInstanceLabel(instanceIndex),
    dirty: state.dirtyInstances[instance.id] === true,
    prompt: instance.prompt
      ? {
          ...(instance.prompt.id ? { id: instance.prompt.id } : {}),
          ...(instance.prompt.version
            ? { version: instance.prompt.version }
            : {}),
          ...(instance.prompt.tag !== undefined
            ? { tag: instance.prompt.tag }
            : {}),
        }
      : null,
    messages,
  };
  return {
    ok: true,
    output: {
      ...snapshotWithoutRevision,
      revision: buildRevision(snapshotWithoutRevision),
    },
  };
}

/**
 * Duplicates an existing playground prompt instance for A/B comparison.
 * Copies all messages with fresh IDs; the clone starts in a non-dirty state.
 */
export function clonePromptInstance({
  playgroundStore,
  instanceId,
}: {
  playgroundStore: PlaygroundStore;
  instanceId?: number;
}): PromptActionResult<{
  sourceInstanceId: number;
  sourceLabel: string;
  clonedInstanceId: number;
  clonedLabel: string;
  revision: string;
  message: string;
}> {
  const source = getPromptSnapshot({ playgroundStore, instanceId });
  if (!source.ok) return source;
  if (
    playgroundStore.getState().instances.length >= NUM_MAX_PLAYGROUND_INSTANCES
  ) {
    return {
      ok: false,
      error: `Cannot clone prompt instance: the playground supports at most ${NUM_MAX_PLAYGROUND_INSTANCES} comparison instances. Delete an existing instance before cloning another.`,
    };
  }
  let clonedInstanceId: number | null = null;
  playgroundStore.setState((state) => {
    const sourceInstance = state.instances.find(
      (candidate) => candidate.id === source.output.instanceId
    );
    if (!sourceInstance || sourceInstance.template.__type !== "chat") {
      return state;
    }
    const copiedMessages = sourceInstance.template.messageIds
      .map((messageId) => state.allInstanceMessages[messageId])
      .filter((message): message is ChatMessage => message != null)
      .map((message) => ({
        ...message,
        id: generateMessageId(),
      }));
    if (copiedMessages.length !== sourceInstance.template.messageIds.length) {
      return state;
    }
    const clonedMessageIds = copiedMessages.map((message) => message.id);
    const clonedMessages = copiedMessages.reduce<Record<number, ChatMessage>>(
      (acc, message) => {
        acc[message.id] = message;
        return acc;
      },
      {}
    );
    clonedInstanceId = generateInstanceId();
    return {
      ...state,
      allInstanceMessages: {
        ...state.allInstanceMessages,
        ...clonedMessages,
      },
      instances: [
        ...state.instances,
        {
          ...sourceInstance,
          id: clonedInstanceId,
          template: {
            ...sourceInstance.template,
            messageIds: clonedMessageIds,
          },
          activeRunId: null,
          experiment: null,
          repetitions: {},
        },
      ],
    };
  });
  if (clonedInstanceId == null) {
    return {
      ok: false,
      error: "Unable to clone the playground prompt instance.",
    };
  }
  const cloned = getPromptSnapshot({
    playgroundStore,
    instanceId: clonedInstanceId,
  });
  return {
    ok: true,
    output: {
      sourceInstanceId: source.output.instanceId,
      sourceLabel: source.output.label,
      clonedInstanceId,
      clonedLabel: cloned.ok ? cloned.output.label : "",
      revision: cloned.ok ? cloned.output.revision : source.output.revision,
      message: "Prompt instance cloned for comparison.",
    },
  };
}

/**
 * Adds a fresh default chat prompt instance while inheriting runnable
 * playground configuration from the first mounted instance.
 */
export function addPromptInstance({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}): PromptActionResult<{
  status: "added";
  addedInstance: PromptSnapshot;
  message: string;
}> {
  const state = playgroundStore.getState();
  if (state.instances.length >= NUM_MAX_PLAYGROUND_INSTANCES) {
    return {
      ok: false,
      error: `Cannot add prompt instance: the playground supports at most ${NUM_MAX_PLAYGROUND_INSTANCES} comparison instances. Delete an existing instance before adding another.`,
    };
  }
  if (state.instances.some((instance) => instance.activeRunId != null)) {
    return {
      ok: false,
      error: "Cannot add prompt instance while the playground is running.",
    };
  }
  const firstInstance = state.instances[0];
  if (!firstInstance) {
    return {
      ok: false,
      error:
        "Cannot add prompt instance because the playground has no source configuration.",
    };
  }

  const { instance, instanceMessages } = createNormalizedPlaygroundInstance();
  const addedInstance = {
    ...instance,
    model: firstInstance.model,
    tools: firstInstance.tools,
    toolChoice: firstInstance.toolChoice,
    prompt: null,
  };
  playgroundStore.setState(
    (currentState) => ({
      ...currentState,
      allInstanceMessages: {
        ...currentState.allInstanceMessages,
        ...instanceMessages,
      },
      instances: [...currentState.instances, addedInstance],
    }),
    false,
    { type: "addPromptInstance/agent" }
  );

  const snapshot = getPromptSnapshot({
    playgroundStore,
    instanceId: addedInstance.id,
  });
  if (!snapshot.ok) return snapshot;

  return {
    ok: true,
    output: {
      status: "added",
      addedInstance: snapshot.output,
      message: "Default prompt instance added for comparison.",
    },
  };
}

/**
 * Removes one prompt instance using the same minimum-instance guard as the UI.
 */
export function removePromptInstance({
  playgroundStore,
  instanceId,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
}): PromptActionResult<{
  status: "removed";
  instanceId: number;
  label: string;
  message: string;
}> {
  const removableInstance = resolveRemovablePromptInstance({
    playgroundStore,
    instanceId,
  });
  if (!removableInstance.ok) return removableInstance;

  playgroundStore.getState().deleteInstance(instanceId);
  return {
    ok: true,
    output: {
      status: "removed",
      instanceId: removableInstance.output.instanceId,
      label: removableInstance.output.label,
      message: "Prompt instance removed.",
    },
  };
}

export function resolveRemovablePromptInstance({
  playgroundStore,
  instanceId,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
}): PromptActionResult<{
  instanceId: number;
  label: string;
}> {
  const state = playgroundStore.getState();
  if (state.instances.length <= 1) {
    return {
      ok: false,
      error:
        "Cannot remove prompt instance because the playground must keep at least one instance.",
    };
  }
  const instanceIndex = state.instances.findIndex(
    (candidate) => candidate.id === instanceId
  );
  if (instanceIndex === -1) {
    return {
      ok: false,
      error: `Playground instance ${instanceId} was not found.`,
    };
  }
  return {
    ok: true,
    output: {
      instanceId,
      label: getInstanceLabel(instanceIndex),
    },
  };
}

/**
 * Applies a sequence of edit operations to a snapshot without mutating store
 * state. Returns the resulting snapshot and materialized operations (with
 * generated message IDs for inserts). Used to preview edits before commit.
 */
export function buildProposedPromptSnapshot({
  snapshot,
  operations,
}: {
  snapshot: PromptSnapshot;
  operations: EditPromptOperation[];
}): PromptActionResult<{
  after: PromptSnapshot;
  operations: MaterializedEditPromptOperation[];
}> {
  let messages = snapshot.messages.map((message) => ({ ...message }));
  const materializedOperations: MaterializedEditPromptOperation[] = [];
  for (const operation of operations) {
    switch (operation.type) {
      case "update_message": {
        const messageIndex = messages.findIndex(
          (message) => message.id === operation.messageId
        );
        if (messageIndex === -1) {
          return {
            ok: false,
            error: `Message ${operation.messageId} was not found.`,
          };
        }
        messages = messages.map((message) =>
          message.id === operation.messageId
            ? {
                ...message,
                ...(operation.role ? { role: operation.role } : {}),
                ...(operation.content !== undefined
                  ? { content: operation.content }
                  : {}),
                ...(operation.toolCalls !== undefined
                  ? { toolCalls: operation.toolCalls }
                  : {}),
              }
            : message
        );
        materializedOperations.push(operation);
        break;
      }
      case "insert_message": {
        const insertIndex = getInsertIndex({
          messageIds: messages.map((m) => m.id),
          afterMessageId: operation.afterMessageId,
        });
        if (insertIndex == null) {
          return {
            ok: false,
            error: `Insertion anchor ${operation.afterMessageId} was not found.`,
          };
        }
        const messageId = generateMessageId();
        const message: PromptMessageSnapshot = {
          id: messageId,
          role: operation.role,
          content: operation.content ?? "",
          ...(operation.toolCalls !== undefined
            ? { toolCalls: operation.toolCalls }
            : {}),
        };
        messages = [
          ...messages.slice(0, insertIndex),
          message,
          ...messages.slice(insertIndex),
        ];
        materializedOperations.push({ ...operation, messageId });
        break;
      }
      case "delete_message": {
        if (!messages.some((message) => message.id === operation.messageId)) {
          return {
            ok: false,
            error: `Message ${operation.messageId} was not found.`,
          };
        }
        messages = messages.filter(
          (message) => message.id !== operation.messageId
        );
        materializedOperations.push(operation);
        break;
      }
      case "reorder_messages": {
        const currentIds = messages
          .map((message) => message.id)
          .sort((left, right) => left - right);
        const nextIds = [...operation.messageIds].sort(
          (left, right) => left - right
        );
        const hasSameIds =
          currentIds.length === nextIds.length &&
          currentIds.every((messageId, index) => messageId === nextIds[index]);
        if (!hasSameIds) {
          return {
            ok: false,
            error:
              "reorder_messages must include every current message ID exactly once.",
          };
        }
        messages = operation.messageIds.map(
          (messageId) => messages.find((message) => message.id === messageId)!
        );
        materializedOperations.push(operation);
        break;
      }
    }
  }
  const afterWithoutRevision = {
    ...snapshot,
    messages,
    revision: undefined,
  };
  const after = {
    ...snapshot,
    messages,
    revision: buildRevision({ ...afterWithoutRevision, revision: undefined }),
  };
  return { ok: true, output: { after, operations: materializedOperations } };
}

/**
 * Commits materialized edit operations to the playground store. Updates
 * messages in place, bumps external revision counters so CodeMirror editors
 * remount, and marks the instance as dirty.
 */
export function applyPromptOperations({
  playgroundStore,
  instanceId,
  operations,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  operations: MaterializedEditPromptOperation[];
}) {
  playgroundStore.setState((state) => {
    const instance = state.instances.find(
      (candidate) => candidate.id === instanceId
    );
    if (!instance || instance.template.__type !== "chat") return state;
    let messageIds = [...instance.template.messageIds];
    let allInstanceMessages = { ...state.allInstanceMessages };
    let externallyUpdatedMessageRevisionById = {
      ...state.externallyUpdatedMessageRevisionById,
    };
    const bumpExternalRevision = (messageId: number) => {
      // CodeMirror-backed prompt editors are uncontrolled. Bump this only for
      // accepted external edits so the affected editor remounts and picks up
      // store changes; normal typing should not touch it.
      externallyUpdatedMessageRevisionById = {
        ...externallyUpdatedMessageRevisionById,
        [messageId]: (externallyUpdatedMessageRevisionById[messageId] ?? 0) + 1,
      };
    };
    for (const operation of operations) {
      switch (operation.type) {
        case "update_message": {
          const message = allInstanceMessages[operation.messageId];
          if (!message) break;
          allInstanceMessages = {
            ...allInstanceMessages,
            [operation.messageId]: {
              ...message,
              ...(operation.role ? { role: operation.role } : {}),
              ...(operation.content !== undefined
                ? { content: operation.content }
                : {}),
              ...(operation.toolCalls !== undefined
                ? { toolCalls: operation.toolCalls }
                : {}),
            },
          };
          bumpExternalRevision(operation.messageId);
          break;
        }
        case "insert_message": {
          const insertIndex = getInsertIndex({
            messageIds,
            afterMessageId: operation.afterMessageId,
          });
          if (insertIndex == null) break;
          messageIds = [
            ...messageIds.slice(0, insertIndex),
            operation.messageId,
            ...messageIds.slice(insertIndex),
          ];
          allInstanceMessages = {
            ...allInstanceMessages,
            [operation.messageId]: {
              id: operation.messageId,
              role: operation.role,
              content: operation.content ?? "",
              ...(operation.toolCalls !== undefined
                ? { toolCalls: operation.toolCalls }
                : {}),
            } as ChatMessage,
          };
          bumpExternalRevision(operation.messageId);
          break;
        }
        case "delete_message": {
          messageIds = messageIds.filter(
            (messageId) => messageId !== operation.messageId
          );
          const { [operation.messageId]: _deleted, ...remainingMessages } =
            allInstanceMessages;
          allInstanceMessages = remainingMessages;
          break;
        }
        case "reorder_messages":
          messageIds = operation.messageIds;
          break;
      }
    }
    return {
      ...state,
      allInstanceMessages,
      externallyUpdatedMessageRevisionById,
      dirtyInstances: {
        ...state.dirtyInstances,
        [instanceId]: true,
      },
      instances: state.instances.map(
        (candidate): PlaygroundNormalizedInstance => {
          if (
            candidate.id !== instanceId ||
            candidate.template.__type !== "chat"
          )
            return candidate;
          return {
            ...candidate,
            template: {
              ...candidate.template,
              messageIds,
            },
          };
        }
      ),
    };
  });
}

export function getInstanceLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

function normalizeMessageSnapshot(
  message: ChatMessage | undefined
): PromptMessageSnapshot | null {
  if (!message) return null;
  const role = parsePromptMessageRole(message.role);
  if (!role) return null;
  return {
    id: message.id,
    role,
    ...(message.content !== undefined ? { content: message.content } : {}),
    ...(message.toolCallId !== undefined
      ? { toolCallId: message.toolCallId }
      : {}),
    ...(message.toolCalls !== undefined
      ? { toolCalls: message.toolCalls }
      : {}),
  };
}

function buildRevision(value: unknown): string {
  const serialized = JSON.stringify(value);
  let hash = 5381;
  for (let index = 0; index < serialized.length; index++) {
    hash = (hash * 33) ^ serialized.charCodeAt(index);
  }
  return `prompt-${(hash >>> 0).toString(16)}`;
}

function getInsertIndex({
  messageIds,
  afterMessageId,
}: {
  messageIds: number[];
  afterMessageId?: number | null;
}) {
  if (afterMessageId == null) return 0;
  const anchorIndex = messageIds.indexOf(afterMessageId);
  return anchorIndex === -1 ? null : anchorIndex + 1;
}
