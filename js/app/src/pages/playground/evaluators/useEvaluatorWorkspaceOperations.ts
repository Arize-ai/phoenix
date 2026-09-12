import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRelayEnvironment } from "react-relay";
import { useSearchParams } from "react-router";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import { getSpanFilterHelp } from "@phoenix/pages/project/spanFilterHelp";
import { fetchSpanFilterProjectVocabulary } from "@phoenix/pages/project/spanFilterProjectVocabulary";
import { validateSpanFilterCondition } from "@phoenix/pages/project/spanFilterValidation";

import type { EvaluatorAgentSlot } from "./evaluatorAgentSlot";
import { fetchProjectIdByName } from "./evaluatorPlaygroundProjectLookup";
import type { EvaluatorPlaygroundSource } from "./evaluatorPlaygroundSource";
import {
  clearSlotBindingParams,
  getConfiguredSource,
  getSlotBindingParam,
  isSameEvaluatorPlaygroundSource,
  writeEvaluatorPlaygroundSource,
} from "./evaluatorPlaygroundSource";
import type {
  SampleExample,
  EvaluatorRun,
  ExpectedOutput,
  SlotExpectations,
} from "./evaluatorResults";
import { createEvaluatorContext } from "./evaluatorResults";
import { setVisibleEvaluatorSlots } from "./evaluatorSlotTypes";
import type { SlotId, SlotSnapshot } from "./evaluatorSlotTypes";
import { createLatestValue } from "./latestValue";
import { useEvaluatorPlaygroundAgent } from "./useEvaluatorPlaygroundAgent";
import type {
  EvaluatorWorkspaceRead,
  EvaluatorWorkspaceReadSource,
} from "./useEvaluatorPlaygroundAgent";

/** How long an operation waits for the page to reflect a change it made. */
const SETTLE_TIMEOUT_MS = 15_000;

/** The page state the PXI operations act on, as of the latest render. */
type EvaluatorWorkspaceState = {
  source: EvaluatorPlaygroundSource | null;
  sampleSize: number;
  sampleKey: string;
  sampleLoaded: boolean;
  visibleSlotIds: SlotId[];
  examples: SampleExample[];
  slots: Partial<Record<SlotId, SlotSnapshot>>;
  runs: Partial<Record<SlotId, EvaluatorRun>>;
  expected: SlotExpectations;
  staleSlots: string[];
  isRunning: boolean;
  isSavingExpectedOutputs: boolean;
  runSlots: (slots: SlotId[], exampleIds?: readonly string[]) => Promise<void>;
  stop: () => void;
  saveExpectedOutput: (
    example: SampleExample,
    slot: SlotId,
    output: ExpectedOutput | null,
    options?: { immediate?: boolean }
  ) => Promise<UIOperationResult>;
};

/** Bridges the page's run and expected-output paths and its mounted editors to PXI. */
export function useEvaluatorWorkspaceOperations(
  state: EvaluatorWorkspaceState
) {
  // Operations run between renders. They read the page through this value and
  // await the render that reflects a change they made.
  const [latest] = useState(() => createLatestValue(state));
  const [slotHosts] = useState(createSlotHostRegistry);
  const allowNavigation = useRef(false);
  const [, setSearchParams] = useSearchParams();
  const environment = useRelayEnvironment();

  useEffect(() => {
    latest.set(state);
  });

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
  // The source is advertised the way its own page advertises it, so the
  // dataset or project tools mount alongside the playground ones.
  useAdvertiseAgentContext(
    state.source?.kind === "dataset"
      ? {
          type: "dataset",
          datasetNodeId: state.source.datasetId,
          datasetVersionNodeId: state.source.versionId,
        }
      : state.source?.kind === "project"
        ? {
            type: "project",
            projectNodeId: state.source.projectId,
            spanFilter: state.source.filterCondition,
          }
        : null
  );

  const isBusy = state.isRunning || state.isSavingExpectedOutputs;

  function readWorkspace({
    offset,
    limit,
  }: {
    offset: number;
    limit: number;
  }): EvaluatorWorkspaceRead {
    const current = latest.get();
    const visible = current.visibleSlotIds;

    return {
      mode: "evaluators",
      source: toReadSource(current.source),
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
          ...(example.name != null ? { name: example.name } : {}),
          input: example.input,
          output: example.output,
          // The metadata as the evaluator sees it, expected outputs removed.
          metadata: createEvaluatorContext(example).metadata,
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
    getSlot: slotHosts.get,
    readWorkspace,
    isBusy,
    configureWorkspace: async (input) => {
      if (isBusy)
        return {
          ok: false,
          error:
            "Stop the run or wait for expected outputs to save before configuring.",
        };
      const nextSlots = input.slots ?? state.visibleSlotIds;

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
      const projectId = input.projectName
        ? await fetchProjectIdByName(environment, input.projectName)
        : null;

      if (projectId && !projectId.ok)
        return { ok: false, error: projectId.error, code: "NOT_FOUND" };
      const nextSource = getConfiguredSource(
        state.source,
        projectId ? { ...input, projectId: projectId.projectId } : input
      );

      if (!nextSource.ok) return nextSource;
      // The strip applies only a filter the server accepted; PXI's filter
      // goes through the same check so a typo answers with the parser's
      // message instead of a sample query that fails.
      const rejection = await getFilterRejection(nextSource.source);

      if (rejection) return rejection;
      allowNavigation.current = input.discardChanges;
      flushSync(() =>
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous);
          writeEvaluatorPlaygroundSource(next, nextSource.source, state.source);

          if (input.sampleSize != null)
            next.set("sampleSize", String(input.sampleSize));
          setVisibleEvaluatorSlots(next, nextSlots);

          if (input.filter) next.set("resultFilter", input.filter);

          return next;
        })
      );
      allowNavigation.current = false;

      // The router commits the new URL on its own schedule and the changed
      // sample loads through Suspense, so wait for the render that shows the
      // requested source with its sample, not merely the next one.
      const requestedSampleSize = input.sampleSize ?? state.sampleSize;
      const settled = await latest.waitFor(
        (current) =>
          isSameEvaluatorPlaygroundSource(current.source, nextSource.source) &&
          current.sampleSize === requestedSampleSize &&
          (!current.source || current.sampleLoaded),
        SETTLE_TIMEOUT_MS
      );

      if (!settled)
        return {
          ok: false,
          error: "Sample is still loading. Read the workspace before running.",
        };

      return { ok: true, output: readWorkspace({ offset: 0, limit: 20 }) };
    },
    readFilterHelp: async () => {
      const source = latest.get().source;
      const project =
        source?.kind === "project"
          ? await fetchSpanFilterProjectVocabulary({
              projectId: source.projectId,
              includeModels: true,
            })
          : null;

      return { ok: true, output: { ...getSpanFilterHelp(), project } };
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
          ? getSlotBindingParam("dataset", input.slot)
          : input.source.type === "projectEvaluator"
            ? getSlotBindingParam("project", input.slot)
            : `evaluator${input.slot}`;

      flushSync(() =>
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous);
          next.delete(`evaluator${input.slot}`);
          clearSlotBindingParams(next, input.slot);
          next.set(key, source);

          return next;
        })
      );

      // The slot remounts on the new source and registers a fresh adapter.
      const host = await slotHosts.waitFor(
        input.slot,
        (candidate) => candidate.read().sourceKey === source,
        SETTLE_TIMEOUT_MS
      );

      return host
        ? { ok: true, output: host.read() }
        : {
            ok: false,
            error:
              "Evaluator is still loading or unavailable. Read the workspace before continuing.",
          };
    },
    runSlots: async (requested, exampleIds) => {
      const current = latest.get();

      if (current.isRunning || current.isSavingExpectedOutputs)
        return {
          ok: false,
          error: "A run or expected-output save is already active.",
        };
      const targets = requested ?? current.visibleSlotIds;

      if (new Set(targets).size !== targets.length)
        return { ok: false, error: "Each slot may be run only once per call." };

      if (!current.examples.length)
        return {
          ok: false,
          error:
            "Select a dataset or project and wait for a nonempty sample to load.",
        };

      if (
        exampleIds?.some(
          (id) => !current.examples.some((example) => example.id === id)
        )
      )
        return {
          ok: false,
          error:
            "Every exampleId must be in the loaded sample. Read the workspace for the current row ids.",
        };

      for (const slot of targets) {
        if (!current.visibleSlotIds.includes(slot))
          return {
            ok: false,
            error: "Slot is not visible. Configure visible slots first.",
          };

        if (
          !slotHosts.get(slot) ||
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
      // The run's final state lands on the next render; read it after it commits.
      await latest.waitFor(
        (next) => !targets.some((slot) => next.runs[slot]?.isRunning),
        SETTLE_TIMEOUT_MS
      );

      return { ok: true, output: readWorkspace({ offset: 0, limit: 20 }) };
    },
    stopRuns: state.stop,
    writeExpectedOutput: async (input) => {
      const current = latest.get();

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

      // PXI needs the outcome now, so its write skips the batching window.
      return current.saveExpectedOutput(
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
    registerAgentSlot: slotHosts.register,
    getSlotHost: slotHosts.get,
  };
}

/** The error `configure` answers with when a project filter fails to parse. */
async function getFilterRejection(
  source: EvaluatorPlaygroundSource | null
): Promise<UIOperationResult | null> {
  if (source?.kind !== "project" || !source.filterCondition) return null;
  const validation = await validateSpanFilterCondition(
    source.filterCondition,
    source.projectId
  );

  return validation.isValid
    ? null
    : {
        ok: false,
        error: `Invalid span filter: ${validation.errorMessage ?? "the condition failed validation"}. Fix the expression (readFilterHelp lists the fields and idioms); nothing was changed.`,
        code: "INVALID_INPUT",
      };
}

function toReadSource(
  source: EvaluatorPlaygroundSource | null
): EvaluatorWorkspaceReadSource | null {
  if (!source) return null;

  return source.kind === "dataset"
    ? {
        kind: "dataset",
        datasetId: source.datasetId,
        splitIds: source.splitIds,
        datasetVersionId: source.versionId,
      }
    : {
        kind: "project",
        projectId: source.projectId,
        filterCondition: source.filterCondition,
        evaluationTarget: "SPAN",
      };
}

/**
 * The PXI adapters of the mounted slot editors. `selectSlot` navigates and then
 * awaits the adapter of the source it navigated to, instead of polling for it.
 */
function createSlotHostRegistry() {
  const hosts = createLatestValue<ReadonlyMap<SlotId, EvaluatorAgentSlot>>(
    new Map()
  );

  return {
    get: (slot: SlotId) => hosts.get().get(slot),
    async waitFor(
      slot: SlotId,
      predicate: (host: EvaluatorAgentSlot) => boolean,
      timeoutMs: number
    ) {
      const all = await hosts.waitFor((current) => {
        const host = current.get(slot);

        return host != null && predicate(host);
      }, timeoutMs);

      return all?.get(slot) ?? null;
    },
    register(slot: SlotId, host: EvaluatorAgentSlot) {
      hosts.set(new Map(hosts.get()).set(slot, host));

      return () => {
        if (hosts.get().get(slot) !== host) return;
        const next = new Map(hosts.get());
        next.delete(slot);
        hosts.set(next);
      };
    },
  };
}
