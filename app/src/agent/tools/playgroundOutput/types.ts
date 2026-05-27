import type { z } from "zod";

import type {
  PlaygroundError,
  PlaygroundRepetition,
  PlaygroundRepetitionStatus,
} from "@phoenix/store/playground";

import type { readPlaygroundOutputInputSchema } from "./schemas";

export type ReadPlaygroundOutputInput = z.output<
  typeof readPlaygroundOutputInputSchema
>;

export type PlaygroundOutputRunStatus =
  | "not_started"
  | "running"
  | "partial"
  | "finished";

export type PlaygroundOutputRepetitionSnapshot = {
  repetitionNumber: number;
  status: PlaygroundRepetitionStatus;
  rawOutput: PlaygroundRepetition["output"];
  traceId: string | null;
  spanNodeId: string | null;
  error: PlaygroundError | null;
  toolCalls: PlaygroundRepetition["toolCalls"][string][];
};

export type PlaygroundOutputInstanceSnapshot = {
  instanceId: number;
  index: number;
  label: string;
  activeRunId: number | null;
  repetitions: PlaygroundOutputRepetitionSnapshot[];
};

export type PlaygroundOutputSnapshot = {
  status: PlaygroundOutputRunStatus;
  instances: PlaygroundOutputInstanceSnapshot[];
  message: string;
};
