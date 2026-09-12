import { css } from "@emotion/react";
import { Suspense, useEffect, useRef, useState } from "react";
import { commitMutation, graphql, useRelayEnvironment } from "react-relay";
import { Group } from "react-resizable-panels";
import { useBlocker, useSearchParams } from "react-router";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  Button,
  EmptyState,
  EmptyStateGraphic,
  Flex,
  Icon,
  Icons,
  Loading,
  View,
} from "@phoenix/components";
import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { CredentialsDropdown } from "@phoenix/pages/playground/PlaygroundCredentialsDropdown";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import {
  DEFAULT_TIME_WINDOW_PRESET_ID,
  makeTimeWindow,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTimeWindow";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { EvaluatorPlaygroundPreviewMutation } from "./__generated__/EvaluatorPlaygroundPreviewMutation.graphql";
import { EvaluatorPlaygroundFrame } from "./EvaluatorPlaygroundFrame";
import { EvaluatorPlaygroundProjectSample } from "./EvaluatorPlaygroundProjectSample";
import { EvaluatorPlaygroundRunButton } from "./EvaluatorPlaygroundRunButton";
import { EvaluatorPlaygroundSample } from "./EvaluatorPlaygroundSample";
import { EvaluatorPlaygroundSaveFilterMenu } from "./EvaluatorPlaygroundSaveFilterMenu";
import {
  EvaluatorPlaygroundSettingsButton,
  DEFAULT_SAMPLE_SIZE,
  parseSampleSize,
} from "./EvaluatorPlaygroundSettingsButton";
import type {
  EvaluatorPlaygroundSource,
  EvaluatorPlaygroundSourceKind,
} from "./evaluatorPlaygroundSource";
import {
  clearSlotBindingParams,
  getSlotBindingParam,
  readEvaluatorPlaygroundSource,
  toEvaluatorSlotSource,
  writeEvaluatorPlaygroundSource,
} from "./evaluatorPlaygroundSource";
import { EvaluatorPlaygroundSourceStrip } from "./EvaluatorPlaygroundSourceStrip";
import type {
  SampleExample,
  EvaluatorPrediction,
  EvaluatorRun,
  ExpectedOutput,
  SlotExpectations,
} from "./evaluatorResults";
import {
  createEvaluatorContext,
  getEvaluatorAnnotationName,
  runEvaluatorSample,
} from "./evaluatorResults";
import { EvaluatorSlot } from "./EvaluatorSlot";
import {
  EVALUATOR_SLOT_IDS,
  getVisibleEvaluatorSlots,
  setVisibleEvaluatorSlots,
} from "./evaluatorSlotTypes";
import type {
  EvaluatorSlotSampleContext,
  EvaluatorSlotSelection,
  SlotId,
  SlotSnapshot,
} from "./evaluatorSlotTypes";
import { useExpectedOutputQueue } from "./expectedOutputQueue";
import { EvaluatorPlaygroundResults } from "./results";
import { useEvaluatorPlaygroundExpectedOutputs } from "./useEvaluatorPlaygroundExpectedOutputs";
import { useEvaluatorWorkspaceOperations } from "./useEvaluatorWorkspaceOperations";

/** One evaluator × row request of a run, with the frozen draft it evaluates. */
type SlotRequest = {
  slotId: SlotId;
  slot: SlotSnapshot;
  preview: NonNullable<SlotSnapshot["preview"]>;
  controller: AbortController;
  example: SampleExample;
};

/**
 * Matches the prompt playground's prompts wrap so the two modes share the same
 * inset and scroll behavior.
 */
const slotsWrapCSS = css`
  padding: var(--global-dimension-size-200);
  scrollbar-gutter: stable;
  height: 100%;
  flex: 1 1 auto;
  overflow: auto;
  box-sizing: border-box;
`;

/**
 * Same floor as a prompt instance: an LLM slot renders the same chat template
 * and model controls, so it needs the same room before scrolling sideways.
 */
const slotCSS = css`
  flex: 1 1 0px;
  min-width: 632px;
`;

const EMPTY_EXAMPLES: SampleExample[] = [];

export default function EvaluatorPlayground() {
  const [searchParams, setSearchParams] = useSearchParams();
  const environment = useRelayEnvironment();
  const credentials = useCredentialsContext((state) => state);

  const hideExpectedAnnotations = usePreferencesContext(
    (state) => state.hideExpectedAnnotationsInMetadata
  );

  const setHideExpectedAnnotations = usePreferencesContext(
    (state) => state.setHideExpectedAnnotationsInMetadata
  );

  const source = readEvaluatorPlaygroundSource(searchParams);
  // The segmented control's choice before a dataset or project is picked.
  const [pendingKind, setPendingKind] =
    useState<EvaluatorPlaygroundSourceKind>("dataset");
  const { sourceKind, filterCondition, windowPreset } = readPlaygroundScope(
    source,
    pendingKind
  );
  const slotSource = toEvaluatorSlotSource(source);
  const [isFilterValid, setIsFilterValid] = useState(true);
  const visibleSlotIds = getVisibleEvaluatorSlots(searchParams);
  const hasComparison = visibleSlotIds.length > 1;
  const sampleSize = parseSampleSize(searchParams.get("sampleSize"));
  const [sampleGeneration, setSampleGeneration] = useState(0);

  // The window's start is fixed when the preset is chosen (or the sample
  // reloaded) so re-renders do not shift it and refetch. A dataset ignores it.
  const [timeWindow, setTimeWindow] = useState(() =>
    makeTimeWindow(windowPreset)
  );

  if (timeWindow.presetId !== windowPreset)
    setTimeWindow(makeTimeWindow(windowPreset));

  const sampleScope = JSON.stringify([
    sampleGeneration,
    source,
    timeWindow.startIso,
  ]);

  const sampleKey = JSON.stringify([sampleScope, sampleSize]);
  const [sample, setSample] = useState<LoadedSample | null>(null);

  const { isSampleLoading, displayedExamples, examples } = getSampleState({
    source,
    sample,
    sampleKey,
    sampleScope,
  });

  const sampleContext = getSampleContext(sourceKind, displayedExamples);

  const [slots, setSlots] = useState<Partial<Record<SlotId, SlotSnapshot>>>({});
  const [runs, setRuns] = useState<Partial<Record<SlotId, EvaluatorRun>>>({});
  const controllers = useRef<Partial<Record<SlotId, AbortController>>>({});
  // Annotations are written in batches (see expectedOutputQueue). The flush reads
  // the sample through this ref so a timer firing later still resolves each
  // row's current revision or annotation ids, not the ones it had when annotated.
  const latestSample = useRef({ source, rows: displayedExamples });
  useEffect(() => {
    latestSample.current = { source, rows: displayedExamples };
  });

  const { flush: flushExpectedOutputs } = useEvaluatorPlaygroundExpectedOutputs(
    {
      getLatest: () => latestSample.current,
      updateRows: (update) =>
        setSample((previous) =>
          previous
            ? { ...previous, examples: update(previous.examples) }
            : previous
        ),
    }
  );

  const expectedOutputQueue = useExpectedOutputQueue(flushExpectedOutputs);
  const isRunning = visibleSlotIds.some((slotId) => runs[slotId]?.isRunning);

  const { expected, currentRuns, staleSlots } = getEvaluatorPlaygroundView({
    slots,
    runs,
    examples,
    sampleKey,
    visibleSlotIds,
    overlay: expectedOutputQueue.overlay,
  });

  const { registerAgentSlot, getSlotHost, allowNavigation } =
    useEvaluatorWorkspaceOperations({
      source,
      sampleSize,
      sampleKey,
      sampleLoaded: sample?.key === sampleKey,
      visibleSlotIds,
      examples,
      slots,
      runs: currentRuns,
      expected,
      staleSlots,
      isRunning,
      isSavingExpectedOutputs: expectedOutputQueue.isSaving,
      runSlots,
      stop,
      saveExpectedOutput,
    });

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowNavigation.current) return false;
    const nextMode = new URLSearchParams(nextLocation.search).get("mode");

    const nextSlots = getVisibleEvaluatorSlots(
      new URLSearchParams(nextLocation.search)
    );

    const removesDirtyComparison = visibleSlotIds.some(
      (slot) => !nextSlots.includes(slot) && slots[slot]?.isDirty
    );

    return (
      removesDirtyComparison ||
      ((isRunning ||
        expectedOutputQueue.pendingCount > 0 ||
        expectedOutputQueue.isSaving ||
        Object.keys(runs).length > 0 ||
        visibleSlotIds.some((slotId) => slots[slotId]?.isDirty)) &&
        (currentLocation.pathname !== nextLocation.pathname ||
          nextMode !== "evaluators"))
    );
  });

  useEffect(
    () => () => {
      for (const controller of Object.values(controllers.current))
        controller?.abort();
    },
    []
  );

  function changeParam(name: string, value: string | null) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);

      if (value == null) next.delete(name);
      else next.set(name, value);

      return next;
    });
  }

  /** Moves to another source. Annotations are resolved against the sample they
   * were made on, so they are written before it goes away. */
  function changeSource(next: EvaluatorPlaygroundSource | null) {
    stop();
    void expectedOutputQueue.flushNow();
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      writeEvaluatorPlaygroundSource(params, next, source);

      return params;
    });
  }

  /**
   * Run the given slots over the sample, or over just the given rows. A
   * whole-column run starts that column over; a row run keeps the column's
   * other results and replaces only the targeted rows.
   */
  async function runSlots(slotIds: SlotId[], exampleIds?: readonly string[]) {
    const targets = exampleIds
      ? examples.filter((example) => exampleIds.includes(example.id))
      : examples;

    const targetIds = new Set(targets.map((example) => example.id));
    // Freeze every slot before the first request, and share one concurrency budget.
    const requests: SlotRequest[] = [];

    for (const slotId of slotIds) {
      const slot = slots[slotId];
      const preview = slot?.preview;

      if (!slot || !preview || slot.validationError || !targets.length)
        continue;
      controllers.current[slotId]?.abort();
      const controller = new AbortController();
      controllers.current[slotId] = controller;
      setRuns((previous) => {
        const current = previous[slotId];

        const kept =
          exampleIds && current?.sampleKey === sampleKey
            ? Object.fromEntries(
                Object.entries(current.predictions).filter(
                  ([id]) => !targetIds.has(id)
                )
              )
            : {};

        return {
          ...previous,
          [slotId]: {
            revision: slot.revision,
            sampleKey,
            predictions: kept,
            queued: targets.map((example) => example.id),
            isRunning: true,
          },
        };
      });

      for (const example of targets)
        requests.push({ slotId, slot, preview, controller, example });
    }

    // Span rows stand in for a scheduled online run, so they fail wherever the
    // live one would; dataset rows keep the preview's plain limits.
    const applyOnlineEvaluationLimits = source?.kind === "project";

    await runEvaluatorSample({
      items: requests,
      execute: async ({ slot, preview, controller, example }) => {
        if (controller.signal.aborted)
          return { status: "error", error: "Stopped" };

        return new Promise<EvaluatorPrediction>((resolve) => {
          commitMutation<EvaluatorPlaygroundPreviewMutation>(environment, {
            mutation: graphql`
              mutation EvaluatorPlaygroundPreviewMutation(
                $input: EvaluatorPreviewsInput!
              ) {
                evaluatorPreviews(input: $input) {
                  results {
                    annotation {
                      name
                      label
                      score
                      explanation
                    }
                    error
                  }
                }
              }
            `,
            variables: {
              input: {
                previews: [
                  {
                    evaluator: preview,
                    context: createEvaluatorContext(example),
                    inputMapping: slot.inputMapping,
                    applyOnlineEvaluationLimits,
                  },
                ],
                credentials: toGqlCredentials(credentials),
              },
            },
            onCompleted(response, errors) {
              if (errors?.length) {
                resolve({
                  status: "error",
                  error: errors.map((error) => error.message).join("\n"),
                });

                return;
              }

              resolve(
                readPrediction(
                  slot,
                  preview,
                  response.evaluatorPreviews.results
                )
              );
            },
            onError(error) {
              resolve({
                status: "error",
                error:
                  getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
                  error.message,
              });
            },
          });
        });
      },
      onResult({ slotId, slot, controller, example }, prediction) {
        if (
          controller.signal.aborted ||
          controllers.current[slotId] !== controller
        )
          return;
        setRuns((previous) => {
          const run = previous[slotId];

          return run
            ? {
                ...previous,
                [slotId]: {
                  ...run,
                  predictions: {
                    ...run.predictions,
                    [example.id]: { ...prediction, revision: slot.revision },
                  },
                  queued: run.queued.filter((id) => id !== example.id),
                },
              }
            : previous;
        });
      },
    });

    for (const slotId of slotIds) {
      const request = requests.find((item) => item.slotId === slotId);

      if (request && controllers.current[slotId] === request.controller) {
        setRuns((previous) => {
          const run = previous[slotId];

          return run
            ? {
                ...previous,
                [slotId]: { ...run, isRunning: false, queued: [] },
              }
            : previous;
        });
      }
    }
  }

  function stop() {
    for (const controller of Object.values(controllers.current))
      controller?.abort();
    setRuns((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([slotId, run]) => [
          slotId,
          { ...run, isRunning: false, queued: [] },
        ])
      )
    );
  }

  /**
   * Record an expected output. It shows as expected immediately and is written with the
   * next batch; `immediate` writes now and reports the outcome, for PXI.
   */
  async function saveExpectedOutput(
    example: SampleExample,
    slotId: SlotId,
    output: ExpectedOutput | null,
    { immediate = false }: { immediate?: boolean } = {}
  ): Promise<UIOperationResult> {
    const slot = slots[slotId];

    const labelName = slot
      ? getEvaluatorAnnotationName({
          evaluatorName: slot.name,
          outputName: slot.selectedOutputName,
          outputCount: slot.outputNames.length,
        })
      : null;

    if (!source || !labelName || isSampleLoading)
      return {
        ok: false,
        error: "Wait for the sample and output to load before annotating.",
      };

    if (!examples.some((current) => current.id === example.id))
      return {
        ok: false,
        error:
          "This row is no longer in the current sample. Load it again before annotating.",
      };
    expectedOutputQueue.enqueue(example.id, labelName, output);

    return immediate ? expectedOutputQueue.flushNow() : { ok: true };
  }

  const providers = getConfiguredProviders(slots, visibleSlotIds);

  // Slots whose draft is complete enough to execute. Run all and a row's play
  // button need every visible slot ready; a column's play needs only its own.
  const runnableSlots = visibleSlotIds.filter(
    (slotId) => !!slots[slotId]?.preview && !slots[slotId]?.validationError
  );

  const canRun =
    !!examples.length && runnableSlots.length === visibleSlotIds.length;

  function reloadSample() {
    stop();

    if (source?.kind === "dataset") changeParam("datasetVersionId", null);
    else setTimeWindow(makeTimeWindow(windowPreset));
    setSampleGeneration((generation) => generation + 1);
  }

  return (
    <EvaluatorPlaygroundFrame
      actions={
        <Flex direction="row" gap="size-100" alignItems="center">
          {providers.length ? (
            <CredentialsDropdown providers={providers} isDisabled={isRunning} />
          ) : null}
          <EvaluatorPlaygroundRunButton
            isRunning={isRunning}
            isDisabled={!canRun}
            onRun={() => void runSlots(visibleSlotIds)}
            onStop={stop}
          />
        </Flex>
      }
    >
      <Group orientation="vertical" style={{ flex: 1, minHeight: 0 }}>
        <TitledPanel
          title="Evaluators"
          headingLevel={2}
          panelProps={{ defaultSize: 55, minSize: 15 }}
          extra={
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.PlusCircle />} />}
              isDisabled={isRunning || visibleSlotIds.length >= 4}
              onPress={() =>
                setSearchParams((previous) => {
                  const next = new URLSearchParams(previous);

                  const available = EVALUATOR_SLOT_IDS.find(
                    (slot) => !visibleSlotIds.includes(slot)
                  );

                  if (available)
                    setVisibleEvaluatorSlots(next, [
                      ...visibleSlotIds,
                      available,
                    ]);

                  return next;
                })
              }
            >
              Add evaluator
            </Button>
          }
        >
          <div css={slotsWrapCSS}>
            <Flex direction="row" gap="size-200" maxWidth="100%">
              {visibleSlotIds.map((slotId) => (
                <section
                  key={slotId}
                  aria-label={`Evaluator ${slotId}`}
                  css={slotCSS}
                >
                  <Suspense fallback={<Loading size="S" />}>
                    <EvaluatorSlot
                      slotId={slotId}
                      registerAgentSlot={registerAgentSlot}
                      source={slotSource}
                      sourceFilterCondition={filterCondition}
                      initialEvaluatorId={searchParams.get(
                        `evaluator${slotId}`
                      )}
                      initialDatasetEvaluatorId={searchParams.get(
                        getSlotBindingParam("dataset", slotId)
                      )}
                      initialProjectEvaluatorId={searchParams.get(
                        getSlotBindingParam("project", slotId)
                      )}
                      sampleContext={sampleContext}
                      onChange={(snapshot) =>
                        setSlots((previous) =>
                          isSameSlotSnapshot(previous[slotId], snapshot)
                            ? previous
                            : { ...previous, [slotId]: snapshot }
                        )
                      }
                      onRemove={
                        hasComparison
                          ? () =>
                              setSearchParams((previous) => {
                                const next = new URLSearchParams(previous);
                                setVisibleEvaluatorSlots(
                                  next,
                                  visibleSlotIds.filter(
                                    (slot) => slot !== slotId
                                  )
                                );
                                writeSlotSelectionParams(next, slotId, null);

                                return next;
                              })
                          : undefined
                      }
                      isRunning={!!runs[slotId]?.isRunning}
                      onSelectionChange={(selection) =>
                        setSearchParams((previous) => {
                          const next = new URLSearchParams(previous);
                          writeSlotSelectionParams(next, slotId, selection);

                          return next;
                        })
                      }
                    />
                  </Suspense>
                </section>
              ))}
            </Flex>
          </div>
        </TitledPanel>
        <TitledPanel
          title="Results"
          headingLevel={2}
          resizable
          panelProps={{ defaultSize: 45, minSize: 15 }}
          extra={
            <EvaluatorPlaygroundSourceStrip
              source={source}
              sourceKind={sourceKind}
              sampleSize={sampleSize}
              isDisabled={isRunning}
              onSourceKindChange={(kind) => {
                setPendingKind(kind);

                if (source && source.kind !== kind) changeSource(null);
              }}
              onSourceChange={changeSource}
              onSampleSizeChange={(size) => {
                void expectedOutputQueue.flushNow();
                changeParam(
                  "sampleSize",
                  size === DEFAULT_SAMPLE_SIZE ? null : String(size)
                );
              }}
              onFilterValidityChange={setIsFilterValid}
              onReload={reloadSample}
            >
              {source?.kind === "project" ? (
                <EvaluatorPlaygroundSaveFilterMenu
                  slots={slots}
                  visibleSlotIds={visibleSlotIds}
                  filterCondition={filterCondition}
                  isFilterValid={isFilterValid}
                  isDisabled={isRunning}
                  onSave={(slotId) =>
                    void getSlotHost(slotId)?.saveFilter(filterCondition)
                  }
                />
              ) : null}
              <EvaluatorPlaygroundSettingsButton
                hideExpectedAnnotations={hideExpectedAnnotations}
                onHideExpectedAnnotationsChange={setHideExpectedAnnotations}
                isDisabled={isRunning}
              />
            </EvaluatorPlaygroundSourceStrip>
          }
        >
          {source ? (
            <Suspense key={sampleKey} fallback={null}>
              <EvaluatorPlaygroundSampleLoader
                source={source}
                sampleKey={sampleKey}
                sampleSize={sampleSize}
                startIso={timeWindow.startIso}
                onLoad={(loaded) =>
                  setSample({
                    key: sampleKey,
                    scope: sampleScope,
                    examples: loaded,
                  })
                }
              />
            </Suspense>
          ) : null}
          {source ? (
            <EvaluatorPlaygroundResults
              examples={examples}
              rowNoun={source.kind === "project" ? "spans" : "examples"}
              isLoading={isSampleLoading}
              sampleSize={sampleSize}
              runs={currentRuns}
              slots={slots}
              visibleSlotIds={visibleSlotIds}
              expected={expected}
              filter={searchParams.get("resultFilter") ?? "all"}
              onFilterChange={(value) => changeParam("resultFilter", value)}
              onSaveExpectedOutput={saveExpectedOutput}
              isRunning={isRunning}
              runnableSlots={runnableSlots}
              onRunSlot={(slot) => void runSlots([slot])}
              onRunExample={(exampleId) =>
                void runSlots(visibleSlotIds, [exampleId])
              }
              hideExpectedAnnotations={hideExpectedAnnotations}
              saveStatus={expectedOutputQueue.status}
              pendingCount={expectedOutputQueue.pendingCount}
              expectedOutputError={expectedOutputQueue.error}
              onRetryExpectedOutputs={() => void expectedOutputQueue.flushNow()}
              onReloadSample={reloadSample}
              staleSlots={staleSlots}
            />
          ) : (
            <EvaluatorPlaygroundEmptySource kind={sourceKind} />
          )}
        </TitledPanel>
      </Group>
      <ConfirmNavigationDialog
        blocker={blocker}
        message={`Leave evaluator playground? Unsaved drafts and run results will be lost. Unsaved annotations are written to the ${
          sourceKind === "project" ? "spans" : "dataset"
        } on the way out.`}
      />
    </EvaluatorPlaygroundFrame>
  );
}

/**
 * Whether a published snapshot changes anything the page reads. A save
 * remounts the slot on the new binding with the same draft, so the save target
 * counts too, or the page would keep offering to create what it just saved.
 */
function isSameSlotSnapshot(
  previous: SlotSnapshot | undefined,
  next: SlotSnapshot
) {
  return (
    previous?.revision === next.revision &&
    previous.validationError === next.validationError &&
    previous.isDirty === next.isDirty &&
    JSON.stringify(previous.saveTarget) === JSON.stringify(next.saveTarget)
  );
}

type LoadedSample = {
  key: string;
  scope: string;
  examples: SampleExample[];
};

/** What the strip and the slots read from the source, with defaults for none. */
function readPlaygroundScope(
  source: EvaluatorPlaygroundSource | null,
  pendingKind: EvaluatorPlaygroundSourceKind
) {
  const project = source?.kind === "project" ? source : null;

  return {
    sourceKind: source?.kind ?? pendingKind,
    filterCondition: project?.filterCondition ?? "",
    windowPreset: project?.window ?? DEFAULT_TIME_WINDOW_PRESET_ID,
  };
}

/**
 * Keep the displayed sample mounted while a size change loads. Execution and
 * review still require the requested sample, and a different source must
 * never display rows from the previous scope.
 */
function getSampleState({
  source,
  sample,
  sampleKey,
  sampleScope,
}: {
  source: EvaluatorPlaygroundSource | null;
  sample: LoadedSample | null;
  sampleKey: string;
  sampleScope: string;
}) {
  const isSampleLoading = source != null && sample?.key !== sampleKey;

  const displayedExamples =
    sample?.scope === sampleScope ? sample.examples : EMPTY_EXAMPLES;

  return {
    isSampleLoading,
    displayedExamples,
    examples: isSampleLoading ? EMPTY_EXAMPLES : displayedExamples,
  };
}

/** Loads the sample for whichever kind of source is selected. */
function EvaluatorPlaygroundSampleLoader({
  source,
  sampleKey,
  sampleSize,
  startIso,
  onLoad,
}: {
  source: EvaluatorPlaygroundSource;
  sampleKey: string;
  sampleSize: number;
  startIso: string;
  onLoad: (rows: SampleExample[]) => void;
}) {
  return source.kind === "dataset" ? (
    <EvaluatorPlaygroundSample
      fetchKey={sampleKey}
      datasetId={source.datasetId}
      first={sampleSize}
      splitIds={source.splitIds}
      versionId={source.versionId}
      onLoad={onLoad}
    />
  ) : (
    <EvaluatorPlaygroundProjectSample
      fetchKey={sampleKey}
      projectId={source.projectId}
      first={sampleSize}
      filterCondition={source.filterCondition}
      startIso={startIso}
      onLoad={onLoad}
    />
  );
}

/**
 * Replaces a slot's source params: the shared evaluator, or the dataset or
 * project evaluator it was opened from. `null` clears them all.
 */
function writeSlotSelectionParams(
  params: URLSearchParams,
  slotId: SlotId,
  selection: EvaluatorSlotSelection | null
) {
  params.delete(`evaluator${slotId}`);
  clearSlotBindingParams(params, slotId);

  if (selection?.evaluatorId)
    params.set(`evaluator${slotId}`, selection.evaluatorId);

  if (selection?.datasetEvaluatorId)
    params.set(
      getSlotBindingParam("dataset", slotId),
      selection.datasetEvaluatorId
    );

  if (selection?.projectEvaluatorId)
    params.set(
      getSlotBindingParam("project", slotId),
      selection.projectEvaluatorId
    );
}

/** The first row as the slots' mapping source, in the source's grain. */
function getSampleContext(
  kind: EvaluatorPlaygroundSourceKind,
  rows: SampleExample[]
): EvaluatorSlotSampleContext {
  return rows[0]
    ? {
        grain: kind === "project" ? "span" : "dataset",
        ...createEvaluatorContext(rows[0]),
      }
    : { grain: "dataset", input: {}, output: {}, reference: {}, metadata: {} };
}

/**
 * The providers the LLM slots are configured to call, so the API Keys
 * dropdown offers exactly the credential fields those runs will need.
 */
function getConfiguredProviders(
  slots: Partial<Record<SlotId, SlotSnapshot>>,
  visibleSlotIds: SlotId[]
) {
  return Array.from(
    new Set(
      visibleSlotIds.flatMap((slotId) => {
        const provider =
          slots[slotId]?.preview?.inlineLlmEvaluator?.promptVersion
            .modelProvider;

        return provider != null && isModelProvider(provider) ? [provider] : [];
      })
    )
  );
}

/** The results panel before a dataset or project is chosen. */
function EvaluatorPlaygroundEmptySource({
  kind,
}: {
  kind: EvaluatorPlaygroundSourceKind;
}) {
  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
    >
      <View padding="size-400">
        {kind === "project" ? (
          <EmptyState
            graphic={<EmptyStateGraphic variant="project" />}
            title="Select a project"
            description="Evaluators run over the project's most recent spans that match the filter in the time window. Each span's output is the response being judged; use a slot's input mapping to judge another field."
          />
        ) : (
          <EmptyState
            graphic={<EmptyStateGraphic variant="dataset" />}
            title="Select a dataset"
            description="Evaluators run over the first examples of a dataset. Each example's output is the response being judged; use a slot's input mapping to judge another field."
          />
        )}
      </View>
    </Flex>
  );
}

/** The slot's selected output out of a preview's flattened results. */
function readPrediction(
  slot: SlotSnapshot,
  preview: NonNullable<SlotSnapshot["preview"]>,
  results: EvaluatorPlaygroundPreviewMutation["response"]["evaluatorPreviews"]["results"]
): EvaluatorPrediction {
  const outputCount =
    preview.inlineLlmEvaluator?.outputConfigs.length ??
    preview.inlineCodeEvaluator?.outputConfigs.length ??
    1;

  const annotationName = getEvaluatorAnnotationName({
    evaluatorName: slot.name,
    outputName: slot.selectedOutputName,
    outputCount,
  });

  const result = results.find(
    (item) => item.annotation?.name === annotationName
  );

  const annotation = result?.annotation;

  const validLabels =
    slot.outputNames.find((output) => output.name === slot.selectedOutputName)
      ?.labels ?? [];

  if (
    !annotation ||
    (validLabels.length > 0 && !validLabels.includes(annotation.label ?? ""))
  )
    return {
      status: "error",
      error:
        result?.error ??
        results.find((item) => item.error)?.error ??
        "Evaluator did not return a label from the selected output.",
    };

  return {
    status: "success",
    label: annotation.label,
    explanation: annotation.explanation,
    score: annotation.score,
  };
}

function getEvaluatorPlaygroundView({
  slots,
  runs,
  examples,
  sampleKey,
  visibleSlotIds,
  overlay,
}: {
  slots: Partial<Record<SlotId, SlotSnapshot>>;
  runs: Partial<Record<SlotId, EvaluatorRun>>;
  examples: SampleExample[];
  sampleKey: string;
  visibleSlotIds: SlotId[];
  /** Annotations not yet confirmed by the server; they win over the stored ones. */
  overlay: Record<string, Record<string, ExpectedOutput | null>>;
}) {
  const expected: SlotExpectations = {};

  for (const slotId of visibleSlotIds) {
    const slot = slots[slotId];

    if (!slot) continue;

    const name = getEvaluatorAnnotationName({
      evaluatorName: slot.name,
      outputName: slot.selectedOutputName,
      outputCount: slot.outputNames.length,
    });

    expected[slotId] = Object.fromEntries(
      examples.flatMap((example) => {
        const pending = overlay[example.id]?.[name];

        const output =
          pending !== undefined
            ? pending
            : example.calibrationLabels.find(
                (item) => item.annotationName === name
              );

        return output ? [[example.id, output]] : [];
      })
    );
  }

  const currentRuns: Partial<Record<SlotId, EvaluatorRun>> = {};

  for (const slotId of visibleSlotIds) {
    if (runs[slotId]?.sampleKey === sampleKey)
      currentRuns[slotId] = runs[slotId];
  }

  // Rows can be run one at a time, so a column is stale as soon as any of its
  // results was produced by an older draft than the one now in the slot.
  const staleSlots = visibleSlotIds.filter((slotId) =>
    Object.values(currentRuns[slotId]?.predictions ?? {}).some(
      (result) => result && result.revision !== slots[slotId]?.revision
    )
  );

  return { expected, currentRuns, staleSlots };
}
