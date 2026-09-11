import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";

import type {
  CalibrationExample,
  CalibrationRun,
  ExpectedOutput,
  SlotExpectations,
} from "./calibration";
import type { EvaluatorAgentSlot } from "./evaluatorAgentSlot";
import {
  EVALUATOR_SLOT_IDS,
  setVisibleEvaluatorSlots,
} from "./evaluatorSlotTypes";
import type { SlotId, SlotSnapshot } from "./evaluatorSlotTypes";
import {
  useEvaluatorPlaygroundAgent,
  waitForEvaluatorSlot,
} from "./useEvaluatorPlaygroundAgent";

/** Bridges the page's actual run/review paths and mounted editors to PXI. */
export function useEvaluatorWorkspaceOperations(state: {
  datasetId: string | null;
  versionId: string | null;
  splitIds: string[];
  sampleSize: number;
  sampleKey: string;
  sampleLoaded: boolean;
  visibleSlotIds: SlotId[];
  examples: CalibrationExample[];
  slots: Partial<Record<SlotId, SlotSnapshot>>;
  runs: Partial<Record<SlotId, CalibrationRun>>;
  expected: SlotExpectations;
  staleSlots: string[];
  isRunning: boolean;
  isSavingReview: boolean;
  runSlots: (slots: SlotId[], exampleIds?: readonly string[]) => Promise<void>;
  stop: () => void;
  saveReview: (
    example: CalibrationExample,
    slot: SlotId,
    output: ExpectedOutput | null,
    options?: { immediate?: boolean }
  ) => Promise<UIOperationResult>;
}) {
  const latest = useRef(state);
  const hosts = useRef(new Map<SlotId, EvaluatorAgentSlot>());
  const allowNavigation = useRef(false);
  const [, setSearchParams] = useSearchParams();
  useEffect(() => {
    latest.current = state;
  }, [state]);
  useAdvertiseAgentContext({
    type: "playground",
    mode: "evaluators",
    recordExperiments: false,
    instances: [],
    sampleSize: state.sampleSize,
    evaluatorSlots: state.visibleSlotIds.map((slot) => ({
      slot,
      name: state.slots[slot]?.name ?? "Loading",
      kind: state.slots[slot]?.kind ?? "LLM",
      isDirty: state.slots[slot]?.isDirty ?? false,
      isRunning: state.runs[slot]?.isRunning ?? false,
    })),
  });
  useAdvertiseAgentContext(
    state.datasetId
      ? {
          type: "dataset",
          datasetNodeId: state.datasetId,
          datasetVersionNodeId: state.versionId,
        }
      : null
  );
  const isBusy = state.isRunning || state.isSavingReview;
  function getSlot(slot: SlotId) {
    return hosts.current.get(slot);
  }
  function readWorkspace({ offset, limit }: { offset: number; limit: number }) {
    const current = latest.current;
    const visible = current.visibleSlotIds;
    return {
      mode: "evaluators",
      datasetId: current.datasetId,
      splitIds: current.splitIds,
      datasetVersionId: current.versionId,
      sampleSize: current.sampleSize,
      sampleLoaded: current.sampleLoaded,
      totalExamples: current.examples.length,
      isRunning: current.isRunning,
      staleSlots: current.staleSlots,
      slots: visible.map((slot) => ({
        slot,
        name: current.slots[slot]?.name,
        outputName: current.slots[slot]?.selectedOutputName,
        kind: current.slots[slot]?.kind,
        validationError: current.slots[slot]?.validationError,
        isDirty: current.slots[slot]?.isDirty,
        isRunning: current.runs[slot]?.isRunning ?? false,
        completed: Object.keys(current.runs[slot]?.predictions ?? {}).length,
      })),
      examples: current.examples
        .slice(offset, offset + limit)
        .map((example) => ({
          id: example.id,
          revisionId: example.revisionId,
          input: example.input,
          output: example.output,
          expectedOutputs: Object.fromEntries(
            visible.map((slot) => [
              slot,
              current.expected[slot]?.[example.id] ?? null,
            ])
          ),
          savedExpectedOutputs: example.calibrationLabels,
          predictions: Object.fromEntries(
            visible.map((slot) => [
              slot,
              current.runs[slot]?.predictions[example.id] ?? null,
            ])
          ),
        })),
      nextOffset:
        offset + limit < current.examples.length ? offset + limit : null,
    };
  }
  useEvaluatorPlaygroundAgent({
    getSlot,
    readWorkspace,
    isBusy,
    configureWorkspace: async (input) => {
      if (isBusy)
        return {
          ok: false,
          error: "Stop the run or wait for review saving before configuring.",
        };
      const nextSlots: SlotId[] =
        input.slots ??
        (input.compare == null
          ? state.visibleSlotIds
          : input.compare
            ? ["A", "B"]
            : ["A"]);
      if (new Set(nextSlots).size !== nextSlots.length)
        return { ok: false, error: "Each visible slot must be unique." };
      if (
        state.visibleSlotIds.some(
          (slot) => !nextSlots.includes(slot) && state.slots[slot]?.isDirty
        ) &&
        !input.discardChanges
      )
        return {
          ok: false,
          error:
            "A removed slot has unsaved changes. Save it or explicitly set discardChanges.",
        };
      allowNavigation.current = input.discardChanges;
      flushSync(() =>
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous);
          if (input.datasetId !== undefined) {
            next.delete("datasetId");
            next.delete("datasetVersionId");
            next.delete("splitId");
            if (input.datasetId) next.set("datasetId", input.datasetId);
            if (input.datasetId !== state.datasetId) {
              EVALUATOR_SLOT_IDS.forEach((slot) =>
                next.delete(`datasetEvaluator${slot}`)
              );
            }
          }
          if (input.splitIds) {
            next.delete("splitId");
            input.splitIds.forEach((id) => next.append("splitId", id));
          }
          if (input.sampleSize != null)
            next.set("sampleSize", String(input.sampleSize));
          setVisibleEvaluatorSlots(next, nextSlots);
          if (input.filter) next.set("resultFilter", input.filter);
          return next;
        })
      );
      allowNavigation.current = false;
      const deadline = Date.now() + 15000;
      while (
        latest.current.datasetId &&
        !latest.current.sampleLoaded &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (latest.current.datasetId && !latest.current.sampleLoaded)
        return {
          ok: false,
          error: "Sample is still loading. Read the workspace before running.",
        };
      return { ok: true, output: readWorkspace({ offset: 0, limit: 20 }) };
    },
    selectSlot: async (input) => {
      if (isBusy)
        return {
          ok: false,
          error: "Stop the run before loading another evaluator.",
        };
      if (!state.visibleSlotIds.includes(input.slot))
        return {
          ok: false,
          error: "Configure visible slots before selecting this evaluator.",
        };
      if (state.slots[input.slot]?.isDirty && !input.discardChanges)
        return {
          ok: false,
          error:
            "Slot has unsaved changes. Save it or explicitly set discardChanges.",
        };
      const source =
        input.source.type === "new"
          ? `new-${input.source.kind.toLowerCase()}`
          : input.source.id;
      const key =
        input.source.type === "datasetEvaluator"
          ? `datasetEvaluator${input.slot}`
          : `evaluator${input.slot}`;
      flushSync(() =>
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous);
          next.delete(`evaluator${input.slot}`);
          next.delete(`datasetEvaluator${input.slot}`);
          next.set(key, source);
          return next;
        })
      );
      return waitForEvaluatorSlot(() => getSlot(input.slot), source);
    },
    runSlots: async (requested, exampleIds) => {
      const current = latest.current;
      if (current.isRunning || current.isSavingReview)
        return { ok: false, error: "A run or review save is already active." };
      const targets = requested ?? current.visibleSlotIds;
      if (new Set(targets).size !== targets.length)
        return { ok: false, error: "Each slot may be run only once per call." };
      if (!current.examples.length)
        return {
          ok: false,
          error: "Select a dataset and wait for a nonempty sample to load.",
        };
      if (
        exampleIds?.some(
          (id) => !current.examples.some((example) => example.id === id)
        )
      )
        return {
          ok: false,
          error:
            "Every exampleId must be in the loaded sample. Read the workspace for the current example ids.",
        };
      for (const slot of targets) {
        if (!current.visibleSlotIds.includes(slot))
          return {
            ok: false,
            error: "Slot is not visible. Configure visible slots first.",
          };
        if (
          !getSlot(slot) ||
          !current.slots[slot]?.preview ||
          current.slots[slot]?.validationError
        )
          return {
            ok: false,
            error:
              current.slots[slot]?.validationError ??
              `Slot ${slot} is not ready.`,
          };
      }
      await current.runSlots(targets, exampleIds);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { ok: true, output: readWorkspace({ offset: 0, limit: 20 }) };
    },
    stopRuns: state.stop,
    reviewExample: async (input) => {
      const current = latest.current;
      const example = current.examples.find(
        (example) => example.id === input.exampleId
      );
      if (
        !example ||
        example.revisionId !== input.expectedRevisionId ||
        !current.visibleSlotIds.includes(input.slot) ||
        input.outputName !== current.slots[input.slot]?.selectedOutputName
      )
        return {
          ok: false,
          error:
            "Sample, revision, or output changed. Read the workspace again.",
          code: "STALE_REVISION",
        };
      const labels =
        current.slots[input.slot]?.outputNames.find(
          (output) => output.name === input.outputName
        )?.labels ?? [];
      if (
        input.label != null &&
        labels.length > 0 &&
        !labels.includes(input.label)
      )
        return {
          ok: false,
          error:
            "Expected label must be one of this evaluator's selected output labels.",
        };
      // PXI needs the outcome now, so its annotation skips the batching window.
      return current.saveReview(
        example,
        input.slot,
        input.label == null && input.score == null && input.explanation == null
          ? null
          : {
              label: input.label,
              score: input.score,
              explanation: input.explanation,
            },
        { immediate: true }
      );
    },
  });
  return {
    allowNavigation,
    registerAgentSlot(slot: SlotId, host: EvaluatorAgentSlot) {
      hosts.current.set(slot, host);
      return () => {
        if (hosts.current.get(slot) === host) hosts.current.delete(slot);
      };
    },
  };
}
