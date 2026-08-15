import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";
import type {
  CanonicalToolChoice,
  PlaygroundStore,
  Tool,
} from "@phoenix/store/playground";

import type {
  promptToolsActionContextSchema,
  PromptToolsWriteToolOutputSender,
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
  /**
   * Set when a renamed tool was the prompt's forced tool choice: its value is
   * the tool's new name, and the forced tool choice was updated to follow it.
   */
  renamedToolChoiceTo?: string;
  revision: string;
};

/**
 * A validated, not-yet-committed `write_prompt_tools` batch: the resulting tool
 * list plus the metadata needed to render a before/after diff. Produced by
 * `planWritePromptTools` and consumed by `commitWritePromptToolsPlan`.
 */
export type WritePromptToolsPlan = {
  instanceId: number;
  /** Zero-based instance position used to render the A/B/C… badge. */
  index: number;
  /** Active provider whose display format the editor (and diff) renders. */
  provider: ModelProvider;
  /** The instance's tool list before the batch. */
  beforeTools: Tool[];
  /** The instance's tool list after applying the batch. */
  afterTools: Tool[];
  results: WritePromptToolResult[];
  deletedToolIds: number[];
  /** The tool choice to apply on commit, when the batch changes it. */
  toolChoicePatch?: CanonicalToolChoice;
  /** Forced-choice tool was deleted; its (old) name. */
  resetToolChoiceFrom?: string;
  /** Forced-choice tool was renamed; its new name. */
  renamedToolChoiceTo?: string;
};

/**
 * One tool rendered to the exact provider-display text the playground editor
 * shows (see `getToolDefinitionDisplay` / `tool.raw`), paired with the tool's
 * name so diffs can be labeled by the name the user recognizes.
 */
export type PromptToolDisplayEntry = {
  id: number;
  name: string;
  /** `JSON.stringify(displayValue, null, 2)` — character-for-character editor text. */
  text: string;
};

/**
 * Snapshot of one prompt instance's tool list materialized to provider-display
 * text, used as the before/after operands of the approval diff.
 */
export type PromptToolsDisplaySnapshot = {
  instanceId: number;
  index: number;
  label: string;
  entries: PromptToolDisplayEntry[];
};

/**
 * Name-keyed summary of what a `write_prompt_tools` batch changes, used for the
 * diff header and the collapsed tool-call preview.
 */
export type PromptToolsWriteSummary = {
  instanceIndex: number;
  instanceLabel: string;
  created: string[];
  updated: string[];
  deleted: string[];
  /** Name of the forced-tool-choice tool reset to auto, if any. */
  resetToolChoiceFrom?: string;
  /** New name the forced tool choice was updated to follow, if any. */
  renamedToolChoiceTo?: string;
};

/**
 * A validated, not-yet-applied `write_prompt_tools` batch awaiting user
 * approval. Mirrors `PendingPromptEdit`: the diff is shown from `before`/`after`
 * and the batch is applied (re-checking the revision) when accepted.
 */
export type PendingPromptToolWrite = {
  toolCallId: string;
  /** Agent session that owns the unresolved write_prompt_tools tool call. */
  sessionId: string;
  instanceId: number;
  expectedRevision: string;
  /** Provider whose display format the user reviewed in the diff. */
  provider: ModelProvider;
  /** The validated batch re-applied on accept. */
  input: WritePromptToolsInput;
  before: PromptToolsDisplaySnapshot;
  after: PromptToolsDisplaySnapshot;
  summary: PromptToolsWriteSummary;
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type PromptToolsActionContext = z.output<
  typeof promptToolsActionContextSchema
>;

export type BindPendingPromptToolWriteOptions = {
  /** Serializable pending batch proposal, possibly restored from Zustand. */
  pendingWrite: PendingPromptToolWrite;
  /** Live playground store used to re-check the revision and apply the batch. */
  playgroundStore: PlaygroundStore;
  /** Live AI SDK tool-output sender for the original tool call. */
  addToolOutput: PromptToolsWriteToolOutputSender;
  setPendingPromptToolWrite: (
    toolCallId: string,
    write: PendingPromptToolWrite | null
  ) => void;
};
