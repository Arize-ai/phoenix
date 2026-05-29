import type { z } from "zod";

import type {
  readPromptToolsInputSchema,
  writePromptToolsInputSchema,
} from "./schemas";

export type ReadPromptToolsInput = z.output<typeof readPromptToolsInputSchema>;

export type WritePromptToolsInput = z.output<
  typeof writePromptToolsInputSchema
>;

/** A single tool entry within a `write_prompt_tools` batch. */
export type WritePromptToolEntry = NonNullable<
  WritePromptToolsInput["tools"]
>[number];

/** Function tool projection sent to PXI in `read_prompt_tools` output. */
export type FunctionPromptToolSnapshot = {
  kind: "function";
  id: number;
  name: string;
  description?: string | null;
  parameters?: unknown;
  strict?: boolean | null;
};

/** Vendor passthrough tool — PXI sees the opaque blob but cannot write it. */
export type RawPromptToolSnapshot = {
  kind: "raw";
  id: number;
  raw: Record<string, unknown>;
};

export type PromptToolSnapshot =
  | FunctionPromptToolSnapshot
  | RawPromptToolSnapshot;

/** Snapshot of one prompt instance's tool list, with a content-hash revision. */
export type PromptToolsSnapshot = {
  instanceId: number;
  index: number;
  label: string;
  tools: PromptToolSnapshot[];
  revision: string;
};

export type PromptToolsActionResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string };

/** Per-entry outcome within a `write_prompt_tools` batch. */
export type WritePromptToolResult = {
  status: "created" | "updated";
  toolId: number;
};

/** Returned to PXI from `write_prompt_tools` describing the applied batch. */
export type WritePromptToolsResult = {
  results: WritePromptToolResult[];
  deletedToolIds: number[];
  /**
   * Set when a deleted tool was the prompt's forced tool choice: its value is
   * that tool's name, and the tool choice was reset to auto (ZERO_OR_MORE).
   */
  resetToolChoiceFrom?: string;
  revision: string;
};
