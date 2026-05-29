import type { z } from "zod";

import type { PlaygroundStore } from "@phoenix/store/playground";

import type {
  CreateChatPromptInput,
  savePlaygroundPromptCreateMutation$data,
} from "./__generated__/savePlaygroundPromptCreateMutation.graphql";
import type {
  CreateChatPromptVersionInput,
  savePlaygroundPromptCreateVersionMutation$data,
} from "./__generated__/savePlaygroundPromptCreateVersionMutation.graphql";
import type { savePromptInputSchema } from "./schemas";

export type SavePromptInput = z.output<typeof savePromptInputSchema>;

export type SavePromptMode = "create" | "update";

export type SavePromptOutput = {
  status: "saved";
  mode: SavePromptMode;
  instanceId: number;
  label: string;
  promptId: string;
  promptName: string;
  promptVersionId: string;
  tag: string | null;
  dirtyBeforeSave: boolean;
  message: string;
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

export type CreatePromptResponse =
  savePlaygroundPromptCreateMutation$data["createChatPrompt"];

export type CreatePromptVersionResponse =
  savePlaygroundPromptCreateVersionMutation$data["createChatPromptVersion"];
