import type { UIOperationErrorCode } from "@phoenix/agent/uiOperations/types";
import type { PlaygroundNormalizedInstance } from "@phoenix/store/playground";

/**
 * A step of a task operation: its output, or the failure the operation
 * resolves with. Failures carry a branchable `code` where one applies.
 */
export type PlaygroundTaskResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string; code?: UIOperationErrorCode };

/** The instance an operation addresses, with its position and letter. */
export type ResolvedPlaygroundInstance = {
  instance: PlaygroundNormalizedInstance;
  index: number;
  label: string;
};
