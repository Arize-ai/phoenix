import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";
import type { UiOperationResultEmitter } from "@phoenix/agent/uiOperations/types";
import type { PlaygroundStore } from "@phoenix/store/playground";

import type {
  CreateChatPromptInput,
  savePlaygroundPromptCreateMutation$data,
} from "./__generated__/savePlaygroundPromptCreateMutation.graphql";
import type {
  CreateChatPromptVersionInput,
  savePlaygroundPromptCreateVersionMutation$data,
} from "./__generated__/savePlaygroundPromptCreateVersionMutation.graphql";
import type {
  savePromptInputSchema,
  savePromptModeSchema,
  savePromptOutputSchema,
} from "./schemas";

export type SavePromptInput = z.output<typeof savePromptInputSchema>;

export type SavePromptMode = z.output<typeof savePromptModeSchema>;

export type SavePromptOutput = z.output<typeof savePromptOutputSchema>;

export type SavePromptPreview = {
  mode: SavePromptMode;
  instanceId: number;
  label: string;
  promptId: string | null;
  promptName: string;
  description: string;
  tags: string[];
  dirtyBeforeSave: boolean;
};

export type SavePromptMutationResult = {
  promptId: string;
  promptName: string;
  promptVersionId: string;
};

export type SavePromptMutationInput =
  | {
      mode: "create";
      input: CreateChatPromptInput;
    }
  | {
      mode: "update";
      input: CreateChatPromptVersionInput;
    };

export type SavePromptMutationCommitter = (
  mutation: SavePromptMutationInput
) => Promise<SavePromptMutationResult>;

export type SavePlaygroundPromptParams = {
  playgroundStore: PlaygroundStore;
  input: SavePromptInput;
  commitPrompt?: SavePromptMutationCommitter;
};

export type SavePlaygroundPromptPreviewParams = {
  playgroundStore: PlaygroundStore;
  input: SavePromptInput;
};

export type SavePromptActionResult =
  // `output` is JSON-serializable structured data, not pre-stringified JSON:
  // it is embedded in the `execute_ui` script result and serialized once there.
  { ok: true; output?: unknown } | { ok: false; error: string };

export type SavePromptAction = (
  input: SavePromptInput
) => Promise<SavePromptActionResult>;

export type PendingSavePrompt = {
  /**
   * Key of this pending entry. Under `execute_ui` this is the inner
   * operation call id (`<toolCallId>:<sequence>`), not an AI SDK toolCallId;
   * the field keeps its historical name to limit churn across consumers.
   */
  toolCallId: string;
  /** Agent session that owns the unresolved playground.prompt.save call. */
  sessionId: string;
  /** Parsed save_prompt input awaiting user approval. */
  input: SavePromptInput;
  /** Effective save target and metadata shown to the user before approval. */
  preview: SavePromptPreview;
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type BindPendingSavePromptOptions = {
  pendingSave: PendingSavePrompt;
  savePrompt: SavePromptAction;
  /** Resolves the awaiting `execute_ui` script call with the user's decision. */
  emitResult: UiOperationResultEmitter;
  setPendingSavePrompt: (
    toolCallId: string,
    pendingSave: PendingSavePrompt | null
  ) => void;
};

export type CreatePromptResponse =
  savePlaygroundPromptCreateMutation$data["createChatPrompt"];

export type CreatePromptVersionResponse =
  savePlaygroundPromptCreateVersionMutation$data["createChatPromptVersion"];
