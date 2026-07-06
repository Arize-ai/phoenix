import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { z } from "zod";

import type { PendingApprovalActions } from "@phoenix/agent/shared/pendingApproval";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { SAVE_PROMPT_TOOL_NAME } from "./constants";

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

export type SavePromptToolOutputSender = Chat<UIMessage>["addToolOutput"];

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
  | { ok: true; output?: string }
  | { ok: false; error: string };

export type SavePromptAction = (
  input: SavePromptInput
) => Promise<SavePromptActionResult>;

export type PendingSavePrompt = {
  toolCallId: string;
  toolName: typeof SAVE_PROMPT_TOOL_NAME;
  /** Agent session that owns the unresolved save_prompt tool call. */
  sessionId: string;
  /** Parsed save_prompt input awaiting user approval. */
  input: SavePromptInput;
  /** Effective save target and metadata shown to the user before approval. */
  preview: SavePromptPreview;
} & PendingApprovalActions;

export type BindPendingSavePromptOptions = {
  pendingSave: Omit<PendingSavePrompt, keyof PendingApprovalActions>;
  savePrompt: SavePromptAction;
  addToolOutput: SavePromptToolOutputSender;
  /** Clears this proposal from the unified pending-approval store slice. */
  clearPending: (toolCallId: string) => void;
};

export type CreatePromptResponse =
  savePlaygroundPromptCreateMutation$data["createChatPrompt"];

export type CreatePromptVersionResponse =
  savePlaygroundPromptCreateVersionMutation$data["createChatPromptVersion"];
