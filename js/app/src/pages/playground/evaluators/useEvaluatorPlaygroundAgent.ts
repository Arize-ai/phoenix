import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { z } from "zod";

import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  configureEvaluatorPlaygroundOperation as configure,
  editEvaluatorPlaygroundSlotOperation as edit,
  readEvaluatorPlaygroundOperation as read,
  readEvaluatorPlaygroundSlotOperation as readSlot,
  reviewEvaluatorPlaygroundOperation as review,
  runEvaluatorPlaygroundOperation as run,
  saveEvaluatorPlaygroundSlotOperation as save,
  selectEvaluatorPlaygroundSlotOperation as select,
  stopEvaluatorPlaygroundOperation as stop,
} from "@phoenix/agent/uiOperations/operations/evaluatorPlayground";
import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

import type { EvaluatorAgentSlot } from "./evaluatorAgentSlot";
import type { SlotId } from "./evaluatorSlotTypes";

export type ConfigureEvaluatorWorkspace = z.infer<typeof configure.inputSchema>;
export type SelectEvaluatorSlot = z.infer<typeof select.inputSchema>;
export type ReviewEvaluatorExample = z.infer<typeof review.inputSchema>;

/** Wait for a navigated source to finish loading; never claim readiness early. */
export async function waitForEvaluatorSlot(
  getSlot: () => EvaluatorAgentSlot | undefined,
  sourceKey: string
) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const host = getSlot();
    if (host?.read().sourceKey === sourceKey)
      return { ok: true as const, output: host.read() };
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return {
    ok: false as const,
    error:
      "Evaluator is still loading or unavailable. Read the workspace before continuing.",
  };
}

/** Mounts only evaluator-mode operations. A–D share a dispatcher, never handler names. */
export function useEvaluatorPlaygroundAgent({
  getSlot,
  readWorkspace,
  configureWorkspace,
  selectSlot,
  runSlots,
  stopRuns,
  reviewExample,
  isBusy,
}: {
  getSlot: (slot: SlotId) => EvaluatorAgentSlot | undefined;
  readWorkspace: (input: z.infer<typeof read.inputSchema>) => unknown;
  configureWorkspace: (
    input: ConfigureEvaluatorWorkspace
  ) => Promise<UIOperationResult>;
  selectSlot: (input: SelectEvaluatorSlot) => Promise<UIOperationResult>;
  runSlots: (slots?: SlotId[]) => Promise<UIOperationResult>;
  stopRuns: () => void;
  reviewExample: (input: ReviewEvaluatorExample) => Promise<UIOperationResult>;
  isBusy: boolean;
}) {
  const agentStore = useAgentStore();
  const writeLock = useRef(false);
  useEffect(() => {
    async function withWriteLock(
      action: () => Promise<UIOperationResult>
    ): Promise<UIOperationResult> {
      if (writeLock.current || isBusy)
        return {
          ok: false,
          error:
            "Another evaluator run/save or workspace change is active. Wait for it or stop the run.",
        };
      writeLock.current = true;
      try {
        return await action();
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
            output: readWorkspace(input),
          }),
        },
        {
          descriptor: readSlot,
          handler: async ({ slot }) => {
            const host = getSlot(slot);
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
          handler: (input) => withWriteLock(() => configureWorkspace(input)),
        },
        {
          descriptor: select,
          handler: (input) => withWriteLock(() => selectSlot(input)),
        },
        {
          descriptor: edit,
          handler: async (input) => {
            if (isBusy || writeLock.current)
              return {
                ok: false,
                error: "Wait for the active run/save to finish before editing.",
              };
            const host = getSlot(input.slot);
            if (!host)
              return {
                ok: false,
                error: "Requested evaluator slot is not mounted.",
                code: "NOT_AVAILABLE",
              };
            let result: Promise<UIOperationResult> | undefined;
            flushSync(() => {
              result = host.edit(input);
            });
            return result!;
          },
        },
        {
          descriptor: save,
          handler: ({ slot, expectedRevision }) =>
            withWriteLock(async () => {
              return (
                getSlot(slot)?.save(expectedRevision) ?? {
                  ok: false,
                  error: "Requested evaluator slot is not mounted.",
                  code: "NOT_AVAILABLE",
                }
              );
            }),
        },
        {
          descriptor: run,
          handler: ({ slots }) => withWriteLock(() => runSlots(slots)),
        },
        {
          descriptor: stop,
          handler: async () => {
            stopRuns();
            return {
              ok: true,
              output:
                "Evaluator run scheduling stopped; in-flight requests may finish.",
            };
          },
        },
        { descriptor: review, handler: reviewExample },
      ],
    });
  }, [
    agentStore,
    getSlot,
    readWorkspace,
    configureWorkspace,
    selectSlot,
    runSlots,
    stopRuns,
    reviewExample,
    isBusy,
  ]);
}
