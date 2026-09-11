import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { z } from "zod";

import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  configureEvaluatorPlaygroundOperation as configure,
  editEvaluatorPlaygroundSlotOperation as edit,
  readEvaluatorPlaygroundOperation as read,
  readEvaluatorPlaygroundSlotOperation as readSlot,
  runEvaluatorPlaygroundOperation as run,
  saveEvaluatorPlaygroundSlotOperation as save,
  selectEvaluatorPlaygroundSlotOperation as select,
  setExpectedOutputEvaluatorPlaygroundOperation as setExpectedOutput,
  stopEvaluatorPlaygroundOperation as stop,
} from "@phoenix/agent/uiOperations/operations/evaluatorPlayground";
import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

import type { EvaluatorAgentSlot } from "./evaluatorAgentSlot";
import type {
  SampleExample,
  EvaluatorResult,
  ExpectedOutput,
} from "./evaluatorResults";
import type { SlotId, SlotSnapshot } from "./evaluatorSlotTypes";

export type ConfigureEvaluatorWorkspace = z.infer<typeof configure.inputSchema>;

export type SelectEvaluatorSlot = z.infer<typeof select.inputSchema>;

export type SetExpectedOutputInput = z.infer<
  typeof setExpectedOutput.inputSchema
>;

/**
 * What `evaluatorPlayground.read` returns: the workspace as PXI sees it, one
 * page of examples at a time. Predictions and expected outputs are keyed by
 * slot so an agent can compare evaluators without knowing the table layout.
 */
export type EvaluatorWorkspaceRead = {
  mode: "evaluators";
  datasetId: string | null;
  splitIds: string[];
  datasetVersionId: string | null;
  sampleSize: number;
  sampleLoaded: boolean;
  totalExamples: number;
  isRunning: boolean;
  staleSlots: string[];
  slots: {
    slot: SlotId;
    name: string | undefined;
    outputName: string | undefined;
    kind: SlotSnapshot["kind"] | undefined;
    validationError: string | null | undefined;
    isDirty: boolean | undefined;
    isRunning: boolean;
    completed: number;
  }[];
  examples: {
    id: string;
    revisionId: string;
    input: unknown;
    output: unknown;
    expectedOutputs: Partial<Record<SlotId, ExpectedOutput | null>>;
    savedExpectedOutputs: SampleExample["calibrationLabels"];
    predictions: Partial<Record<SlotId, EvaluatorResult | null>>;
  }[];
  nextOffset: number | null;
};

/** What the page gives the operations to act on. Read fresh on every call. */
export type EvaluatorPlaygroundHandlers = {
  getSlot: (slot: SlotId) => EvaluatorAgentSlot | undefined;
  readWorkspace: (
    input: z.infer<typeof read.inputSchema>
  ) => EvaluatorWorkspaceRead;
  configureWorkspace: (
    input: ConfigureEvaluatorWorkspace
  ) => Promise<UIOperationResult>;
  selectSlot: (input: SelectEvaluatorSlot) => Promise<UIOperationResult>;
  runSlots: (
    slots?: SlotId[],
    exampleIds?: string[]
  ) => Promise<UIOperationResult>;
  stopRuns: () => void;
  writeExpectedOutput: (
    input: SetExpectedOutputInput
  ) => Promise<UIOperationResult>;
  isBusy: boolean;
};

const NOT_MOUNTED: UIOperationResult = {
  ok: false,
  error: "Requested evaluator slot is not mounted.",
  code: "NOT_AVAILABLE",
};

/**
 * Mounts only evaluator-mode operations. A–D share a dispatcher, never handler
 * names. The operations are registered once per agent store and read the
 * newest handlers through a ref, so a render never unregisters and
 * re-registers them.
 */
export function useEvaluatorPlaygroundAgent(
  handlers: EvaluatorPlaygroundHandlers
) {
  const agentStore = useAgentStore();
  const latest = useRef(handlers);
  const writeLock = useRef(false);

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    async function withWriteLock(
      action: (
        current: EvaluatorPlaygroundHandlers
      ) => Promise<UIOperationResult>
    ): Promise<UIOperationResult> {
      const current = latest.current;

      if (writeLock.current || current.isBusy)
        return {
          ok: false,
          error:
            "Another evaluator run/save or workspace change is active. Wait for it or stop the run.",
        };
      writeLock.current = true;

      try {
        return await action(current);
      } finally {
        writeLock.current = false;
      }
    }

    return registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: read,
          handler: async (input) => ({
            ok: true,
            output: latest.current.readWorkspace(input),
          }),
        },
        {
          descriptor: readSlot,
          handler: async ({ slot }) => {
            const host = latest.current.getSlot(slot);

            return host
              ? { ok: true, output: host.read() }
              : {
                  ok: false,
                  error: `Evaluator ${slot} is not mounted. Configure visible slots, then select/read its source.`,
                  code: "NOT_AVAILABLE",
                };
          },
        },
        {
          descriptor: configure,
          handler: (input) =>
            withWriteLock((current) => current.configureWorkspace(input)),
        },
        {
          descriptor: select,
          handler: (input) =>
            withWriteLock((current) => current.selectSlot(input)),
        },
        {
          descriptor: edit,
          handler: async (input) => {
            const current = latest.current;

            if (current.isBusy || writeLock.current)
              return {
                ok: false,
                error: "Wait for the active run/save to finish before editing.",
              };
            const host = current.getSlot(input.slot);

            if (!host) return NOT_MOUNTED;

            // Commit the edit's React updates before returning, so an operation
            // that follows (run, save, read) sees the edited draft.
            return flushSync(() => host.edit(input));
          },
        },
        {
          descriptor: save,
          handler: ({ slot, expectedRevision }) =>
            withWriteLock(
              async (current) =>
                current.getSlot(slot)?.save(expectedRevision) ?? NOT_MOUNTED
            ),
        },
        {
          descriptor: run,
          handler: ({ slots, exampleIds }) =>
            withWriteLock((current) => current.runSlots(slots, exampleIds)),
        },
        {
          descriptor: stop,
          handler: async () => {
            latest.current.stopRuns();

            return {
              ok: true,
              output:
                "Evaluator run scheduling stopped; in-flight requests may finish.",
            };
          },
        },
        {
          descriptor: setExpectedOutput,
          handler: (input) => latest.current.writeExpectedOutput(input),
        },
      ],
    });
  }, [agentStore]);
}
