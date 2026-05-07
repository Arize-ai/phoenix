import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type {
  ChatMessage,
  PlaygroundNormalizedInstance,
} from "@phoenix/store/playground";
import {
  generateMessageId,
  type PlaygroundStore,
} from "@phoenix/store/playground";

export const READ_PROMPT_TOOL_NAME = "read_prompt";
export const EDIT_PROMPT_TOOL_NAME = "edit_prompt";

type AddToolOutput = Chat<UIMessage>["addToolOutput"];
export type PromptEditToolOutputSender = AddToolOutput;
type PromptToolCalls = NonNullable<ChatMessage["toolCalls"]>;

const VALID_MESSAGE_ROLES = ["system", "user", "ai", "tool"] as const;
type PromptMessageRole = (typeof VALID_MESSAGE_ROLES)[number];

export type ReadPromptInput = {
  instanceId?: number;
};

export type PromptMessageSnapshot = {
  id: number;
  role: PromptMessageRole;
  content?: string;
  toolCallId?: string;
  toolCalls?: PromptToolCalls;
};

export type PromptSnapshot = {
  instanceId: number;
  index: number;
  revision: string;
  dirty: boolean;
  prompt: {
    id?: string;
    version?: string;
    tag?: string | null;
  } | null;
  messages: PromptMessageSnapshot[];
};

export type UpdatePromptMessageOperation = {
  type: "update_message";
  messageId: number;
  role?: PromptMessageRole;
  content?: string;
  toolCalls?: PromptToolCalls;
};

export type InsertPromptMessageOperation = {
  type: "insert_message";
  afterMessageId?: number | null;
  role: PromptMessageRole;
  content?: string;
  toolCalls?: PromptToolCalls;
};

export type DeletePromptMessageOperation = {
  type: "delete_message";
  messageId: number;
};

export type ReorderPromptMessagesOperation = {
  type: "reorder_messages";
  messageIds: number[];
};

export type EditPromptOperation =
  | UpdatePromptMessageOperation
  | InsertPromptMessageOperation
  | DeletePromptMessageOperation
  | ReorderPromptMessagesOperation;

export type EditPromptInput = {
  instanceId: number;
  expectedRevision: string;
  operations: EditPromptOperation[];
};

type MaterializedInsertPromptMessageOperation = InsertPromptMessageOperation & {
  messageId: number;
};

export type MaterializedEditPromptOperation =
  | UpdatePromptMessageOperation
  | MaterializedInsertPromptMessageOperation
  | DeletePromptMessageOperation
  | ReorderPromptMessagesOperation;

export type PendingPromptEdit = {
  toolCallId: string;
  /** Agent session that owns the unresolved edit_prompt tool call. */
  sessionId: string;
  instanceId: number;
  expectedRevision: string;
  before: PromptSnapshot;
  after: PromptSnapshot;
  operations: MaterializedEditPromptOperation[];
  accept?: () => Promise<void>;
  reject?: () => Promise<void>;
};

export type EditPromptActionContext = {
  toolCallId: string;
  /** Agent session whose chat runtime must receive the eventual tool output. */
  sessionId: string;
  addToolOutput: AddToolOutput;
};

export type BindPendingPromptEditOptions = {
  /** Serializable pending edit proposal, possibly restored from Zustand. */
  pendingEdit: PendingPromptEdit;
  /** Live playground store used to re-check revisions and apply accepted edits. */
  playgroundStore: PlaygroundStore;
  /** Returns the live AI SDK tool-output sender for the pending edit's session. */
  getAddToolOutput: (sessionId: string) => AddToolOutput | undefined;
  setPendingPromptEdit: (
    toolCallId: string,
    edit: PendingPromptEdit | null
  ) => void;
};

export function parseReadPromptInput(input: unknown): ReadPromptInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as { instanceId?: unknown };
  if (
    candidate.instanceId !== undefined &&
    !Number.isInteger(candidate.instanceId)
  ) {
    return null;
  }
  return {
    ...(typeof candidate.instanceId === "number"
      ? { instanceId: candidate.instanceId }
      : {}),
  };
}

export function parseEditPromptInput(input: unknown): EditPromptInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as {
    instance_id?: unknown;
    instanceId?: unknown;
    expected_revision?: unknown;
    expectedRevision?: unknown;
    operation?: unknown;
    operations?: unknown;
  };
  const instanceId = candidate.instanceId ?? candidate.instance_id;
  const expectedRevision =
    candidate.expectedRevision ?? candidate.expected_revision;
  const operationsInput = candidate.operations ?? candidate.operation;
  if (typeof instanceId !== "number" || !Number.isInteger(instanceId)) {
    return null;
  }
  if (typeof expectedRevision !== "string") return null;
  const rawOperations = Array.isArray(operationsInput)
    ? operationsInput
    : typeof operationsInput === "object" && operationsInput !== null
      ? [operationsInput]
      : null;
  if (!rawOperations || rawOperations.length === 0) {
    return null;
  }
  const operations = rawOperations.map(parseEditPromptOperation);
  if (operations.some((operation) => operation == null)) return null;
  return {
    instanceId,
    expectedRevision,
    operations: operations as EditPromptOperation[],
  };
}

function parseEditPromptOperation(input: unknown): EditPromptOperation | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as Record<string, unknown>;
  switch (candidate.type) {
    case "update_message": {
      const messageId = candidate.messageId ?? candidate.message_id;
      const toolCalls = candidate.toolCalls ?? candidate.tool_calls;
      if (typeof messageId !== "number" || !Number.isInteger(messageId)) {
        return null;
      }
      const role = parseOptionalRole(candidate.role);
      if (role === null) return null;
      if (
        candidate.content !== undefined &&
        typeof candidate.content !== "string"
      )
        return null;
      if (toolCalls !== undefined && !Array.isArray(toolCalls)) return null;
      return {
        type: "update_message",
        messageId,
        ...(role ? { role } : {}),
        ...(typeof candidate.content === "string"
          ? { content: candidate.content }
          : {}),
        ...(Array.isArray(toolCalls)
          ? { toolCalls: toolCalls as PromptToolCalls }
          : {}),
      };
    }
    case "insert_message": {
      const role = parseRole(candidate.role);
      const afterMessageId =
        candidate.afterMessageId ?? candidate.after_message_id;
      const toolCalls = candidate.toolCalls ?? candidate.tool_calls;
      if (!role) return null;
      if (
        afterMessageId !== undefined &&
        afterMessageId !== null &&
        !Number.isInteger(afterMessageId)
      ) {
        return null;
      }
      if (
        candidate.content !== undefined &&
        typeof candidate.content !== "string"
      )
        return null;
      if (toolCalls !== undefined && !Array.isArray(toolCalls)) return null;
      return {
        type: "insert_message",
        ...(typeof afterMessageId === "number"
          ? { afterMessageId }
          : { afterMessageId: null }),
        role,
        ...(typeof candidate.content === "string"
          ? { content: candidate.content }
          : {}),
        ...(Array.isArray(toolCalls)
          ? { toolCalls: toolCalls as PromptToolCalls }
          : {}),
      };
    }
    case "delete_message": {
      const messageId = candidate.messageId ?? candidate.message_id;
      return typeof messageId === "number" && Number.isInteger(messageId)
        ? { type: "delete_message", messageId }
        : null;
    }
    case "reorder_messages": {
      const messageIds = candidate.messageIds ?? candidate.message_ids;
      return Array.isArray(messageIds) &&
        messageIds.every((messageId) => Number.isInteger(messageId))
        ? {
            type: "reorder_messages",
            messageIds: messageIds as number[],
          }
        : null;
    }
    default:
      return null;
  }
}

function parseRole(input: unknown): PromptMessageRole | null {
  return typeof input === "string" &&
    VALID_MESSAGE_ROLES.includes(input as PromptMessageRole)
    ? (input as PromptMessageRole)
    : null;
}

function parseOptionalRole(
  input: unknown
): PromptMessageRole | undefined | null {
  if (input === undefined) return undefined;
  return parseRole(input);
}

export function createReadPromptClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadPromptInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid read_prompt input." };
    }
    const snapshot = getPromptSnapshot({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!snapshot.ok) {
      return snapshot;
    }
    return { ok: true, output: JSON.stringify(snapshot.output, null, 2) };
  };
}

export function createEditPromptClientAction({
  playgroundStore,
  setPendingPromptEdit,
}: {
  playgroundStore: PlaygroundStore;
  setPendingPromptEdit: (
    toolCallId: string,
    edit: PendingPromptEdit | null
  ) => void;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const editContext = parseEditPromptActionContext(context);
    if (!editContext) {
      return {
        ok: false,
        error: "Cannot propose prompt edit without tool call context.",
      };
    }
    const parsed = parseEditPromptInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid edit_prompt input." };
    }
    const before = getPromptSnapshot({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!before.ok) return before;
    if (before.output.revision !== parsed.expectedRevision) {
      return {
        ok: false,
        error:
          "The prompt changed since read_prompt was called. Call read_prompt again before proposing edits.",
      };
    }
    const proposed = buildProposedPromptSnapshot({
      snapshot: before.output,
      operations: parsed.operations,
    });
    if (!proposed.ok) return proposed;

    const pendingEdit = bindPendingPromptEditActions({
      pendingEdit: {
        toolCallId: editContext.toolCallId,
        sessionId: editContext.sessionId,
        instanceId: parsed.instanceId,
        expectedRevision: parsed.expectedRevision,
        before: before.output,
        after: proposed.output.after,
        operations: proposed.output.operations,
      },
      playgroundStore,
      getAddToolOutput: () => editContext.addToolOutput,
      setPendingPromptEdit,
    });
    setPendingPromptEdit(editContext.toolCallId, pendingEdit);
    return { ok: true };
  };
}

export function bindPendingPromptEditActions({
  pendingEdit,
  playgroundStore,
  getAddToolOutput,
  setPendingPromptEdit,
}: BindPendingPromptEditOptions): PendingPromptEdit {
  // Persisted pending edits contain data only. Bind live callbacks at runtime
  // so a restored edit can still complete the original AI SDK tool call.
  return {
    ...pendingEdit,
    accept: async () => {
      const addToolOutput = getAddToolOutput(pendingEdit.sessionId);
      if (!addToolOutput) return;
      const current = getPromptSnapshot({
        playgroundStore,
        instanceId: pendingEdit.instanceId,
      });
      if (!current.ok) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_PROMPT_TOOL_NAME,
          toolCallId: pendingEdit.toolCallId,
          errorText: current.error,
        });
        setPendingPromptEdit(pendingEdit.toolCallId, null);
        return;
      }
      if (current.output.revision !== pendingEdit.expectedRevision) {
        await addToolOutput({
          state: "output-error",
          tool: EDIT_PROMPT_TOOL_NAME,
          toolCallId: pendingEdit.toolCallId,
          errorText:
            "The prompt changed after this edit was proposed. Call read_prompt again before proposing another edit.",
        });
        setPendingPromptEdit(pendingEdit.toolCallId, null);
        return;
      }
      applyPromptOperations({
        playgroundStore,
        instanceId: pendingEdit.instanceId,
        operations: pendingEdit.operations,
      });
      const afterApply = getPromptSnapshot({
        playgroundStore,
        instanceId: pendingEdit.instanceId,
      });
      await addToolOutput({
        state: "output-available",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        output: {
          status: "accepted",
          instanceId: pendingEdit.instanceId,
          revision: afterApply.ok
            ? afterApply.output.revision
            : pendingEdit.after.revision,
          message: "Prompt edit applied.",
        },
      });
      setPendingPromptEdit(pendingEdit.toolCallId, null);
    },
    reject: async () => {
      const addToolOutput = getAddToolOutput(pendingEdit.sessionId);
      if (!addToolOutput) return;
      await addToolOutput({
        state: "output-available",
        tool: EDIT_PROMPT_TOOL_NAME,
        toolCallId: pendingEdit.toolCallId,
        output: {
          status: "rejected",
          instanceId: pendingEdit.instanceId,
          message: "User rejected the proposed prompt edit.",
        },
      });
      setPendingPromptEdit(pendingEdit.toolCallId, null);
    },
  };
}

function parseEditPromptActionContext(
  input: unknown
): EditPromptActionContext | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as { toolCallId?: unknown; addToolOutput?: unknown };
  if (typeof candidate.toolCallId !== "string") return null;
  if (typeof (candidate as { sessionId?: unknown }).sessionId !== "string") {
    return null;
  }
  if (typeof candidate.addToolOutput !== "function") return null;
  return candidate as EditPromptActionContext;
}

function getPromptSnapshot({
  playgroundStore,
  instanceId,
}: {
  playgroundStore: PlaygroundStore;
  instanceId?: number;
}): { ok: true; output: PromptSnapshot } | { ok: false; error: string } {
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
  const messages = instance.template.messageIds.map((messageId) => {
    const message = state.allInstanceMessages[messageId];
    return normalizeMessageSnapshot(message);
  });
  if (messages.some((message) => message == null)) {
    return {
      ok: false,
      error: "The playground prompt has missing message state.",
    };
  }
  const snapshotWithoutRevision = {
    instanceId: instance.id,
    index: instances.findIndex((candidate) => candidate.id === instance.id),
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
    messages: messages as PromptMessageSnapshot[],
  };
  return {
    ok: true,
    output: {
      ...snapshotWithoutRevision,
      revision: buildRevision(snapshotWithoutRevision),
    },
  };
}

function normalizeMessageSnapshot(
  message: ChatMessage | undefined
): PromptMessageSnapshot | null {
  if (!message) return null;
  const role = parseRole(message.role);
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

function buildProposedPromptSnapshot({
  snapshot,
  operations,
}: {
  snapshot: PromptSnapshot;
  operations: EditPromptOperation[];
}):
  | {
      ok: true;
      output: {
        after: PromptSnapshot;
        operations: MaterializedEditPromptOperation[];
      };
    }
  | { ok: false; error: string } {
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
          messages,
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

function getInsertIndex({
  messages,
  afterMessageId,
}: {
  messages: PromptMessageSnapshot[];
  afterMessageId?: number | null;
}) {
  if (afterMessageId == null) return 0;
  const anchorIndex = messages.findIndex(
    (message) => message.id === afterMessageId
  );
  return anchorIndex === -1 ? null : anchorIndex + 1;
}

function applyPromptOperations({
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
            messages: messageIds.map((messageId) => ({
              id: messageId,
              role: "user",
            })),
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
