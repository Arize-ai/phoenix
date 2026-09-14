import { css } from "@emotion/react";
import { Suspense, useState } from "react";
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
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { CredentialsDropdown } from "@phoenix/pages/playground/PlaygroundCredentialsDropdown";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import {
  DEFAULT_SAMPLE_SIZE,
  EvaluatorPlaygroundConfigButton,
  parseSampleSize,
} from "./EvaluatorPlaygroundConfigButton";
import { EvaluatorPlaygroundFrame } from "./EvaluatorPlaygroundFrame";
import { EvaluatorPlaygroundRunButton } from "./EvaluatorPlaygroundRunButton";
import { EvaluatorPlaygroundSaveFilterMenu } from "./EvaluatorPlaygroundSaveFilterMenu";
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
  EvaluatorRun,
  ExpectedOutput,
  SlotExpectations,
} from "./evaluatorResults";
import { getEvaluatorAnnotationName } from "./evaluatorResults";
import { EvaluatorSlot } from "./EvaluatorSlot";
import {
  EVALUATOR_SLOT_IDS,
  getVisibleEvaluatorSlots,
  setVisibleEvaluatorSlots,
} from "./evaluatorSlotTypes";
import type {
  EvaluatorSlotSelection,
  SlotId,
  SlotSnapshot,
} from "./evaluatorSlotTypes";
import { useExpectedOutputQueue } from "./expectedOutputQueue";
import { EvaluatorPlaygroundResults } from "./results";
import { useEvaluatorPlaygroundExpectedOutputs } from "./useEvaluatorPlaygroundExpectedOutputs";
import { useEvaluatorPlaygroundRuns } from "./useEvaluatorPlaygroundRuns";
import {
  EvaluatorPlaygroundSampleLoader,
  useEvaluatorPlaygroundSample,
} from "./useEvaluatorPlaygroundSample";
import { useEvaluatorWorkspaceOperations } from "./useEvaluatorWorkspaceOperations";

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

export default function EvaluatorPlayground() {
  const [searchParams, setSearchParams] = useSearchParams();

  const hideExpectedAnnotations = usePreferencesContext(
    (state) => state.hideExpectedAnnotationsInMetadata
  );

  const setHideExpectedAnnotations = usePreferencesContext(
    (state) => state.setHideExpectedAnnotationsInMetadata
  );
  const runConcurrency = usePreferencesContext(
    (state) => state.evaluatorPlaygroundRunConcurrency
  );
  const setRunConcurrency = usePreferencesContext(
    (state) => state.setEvaluatorPlaygroundRunConcurrency
  );

  const source = readEvaluatorPlaygroundSource(searchParams);
  // The segmented control's choice before a dataset or project is picked.
  const [pendingKind, setPendingKind] =
    useState<EvaluatorPlaygroundSourceKind>("dataset");
  const { sourceKind, filterCondition } = readPlaygroundScope(
    source,
    pendingKind
  );
  const slotSource = toEvaluatorSlotSource(source);
  const [isFilterValid, setIsFilterValid] = useState(true);
  const visibleSlotIds = getVisibleEvaluatorSlots(searchParams);
  const hasComparison = visibleSlotIds.length > 1;
  const sampleSize = parseSampleSize(searchParams.get("sampleSize"));

  const sample = useEvaluatorPlaygroundSample({
    source,
    sourceKind,
    sampleSize,
  });

  const {
    sampleKey,
    isSampleLoading,
    examples,
    sampleContext,
    isSampleLoaded,
  } = sample;

  const [slots, setSlots] = useState<Partial<Record<SlotId, SlotSnapshot>>>({});

  const { runs, runSlots, stop } = useEvaluatorPlaygroundRuns({
    examples,
    slots,
    sampleKey,
    // Span rows stand in for a scheduled online run, so they fail wherever the
    // live one would; dataset rows keep the preview's plain limits.
    applyOnlineEvaluationLimits: source?.kind === "project",
    concurrency: runConcurrency,
  });

  const { flush: flushExpectedOutputs } = useEvaluatorPlaygroundExpectedOutputs(
    { getLatest: sample.getLatest, updateRows: sample.updateRows }
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
      sampleLoaded: isSampleLoaded,
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

  // Slots whose draft is complete enough to execute. Run and a row's play
  // button need every visible slot ready; a column's play needs only its own.
  const runnableSlots = visibleSlotIds.filter(
    (slotId) => !!slots[slotId]?.preview && !slots[slotId]?.validationError
  );

  const canRun =
    !!examples.length && runnableSlots.length === visibleSlotIds.length;

  function reloadSample() {
    stop();

    if (source?.kind === "dataset") changeParam("datasetVersionId", null);
    sample.reload();
  }

  return (
    <EvaluatorPlaygroundFrame
      actions={
        <Flex direction="row" gap="size-100" alignItems="center">
          <CredentialsDropdown providers={providers} isDisabled={isRunning} />
          <EvaluatorPlaygroundConfigButton
            sampleSize={sampleSize}
            rowNoun={sourceKind === "project" ? "spans" : "examples"}
            onSampleSizeChange={(size) => {
              void expectedOutputQueue.flushNow();
              changeParam(
                "sampleSize",
                size === DEFAULT_SAMPLE_SIZE ? null : String(size)
              );
            }}
            concurrency={runConcurrency}
            onConcurrencyChange={setRunConcurrency}
            hideExpectedAnnotations={hideExpectedAnnotations}
            onHideExpectedAnnotationsChange={setHideExpectedAnnotations}
            isDisabled={isRunning}
          />
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
              isDisabled={isRunning}
              onSourceKindChange={(kind) => {
                setPendingKind(kind);

                if (source && source.kind !== kind) changeSource(null);
              }}
              onSourceChange={changeSource}
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
            </EvaluatorPlaygroundSourceStrip>
          }
        >
          {source ? (
            <Suspense key={sampleKey} fallback={null}>
              <EvaluatorPlaygroundSampleLoader
                source={source}
                sampleKey={sampleKey}
                sampleSize={sampleSize}
                onLoad={sample.onLoad}
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

/** What the strip and the slots read from the source, with defaults for none. */
function readPlaygroundScope(
  source: EvaluatorPlaygroundSource | null,
  pendingKind: EvaluatorPlaygroundSourceKind
) {
  const project = source?.kind === "project" ? source : null;

  return {
    sourceKind: source?.kind ?? pendingKind,
    filterCondition: project?.filterCondition ?? "",
  };
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

/** Offered when no LLM slot names a provider, so API Keys is always at hand. */
const DEFAULT_CREDENTIAL_PROVIDERS: ModelProvider[] = ["OPENAI", "ANTHROPIC"];

/**
 * The providers the LLM slots are configured to call, so the API Keys
 * dropdown offers exactly the credential fields those runs will need; the
 * common providers when no slot names one.
 */
function getConfiguredProviders(
  slots: Partial<Record<SlotId, SlotSnapshot>>,
  visibleSlotIds: SlotId[]
): ModelProvider[] {
  const configured = Array.from(
    new Set(
      visibleSlotIds.flatMap((slotId) => {
        const provider =
          slots[slotId]?.preview?.inlineLlmEvaluator?.promptVersion
            .modelProvider;

        return provider != null && isModelProvider(provider) ? [provider] : [];
      })
    )
  );

  return configured.length ? configured : DEFAULT_CREDENTIAL_PROVIDERS;
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
            description="Evaluators run over the project's most recent spans that match the filter. Each span's output is the response being judged; use a slot's input mapping to judge another field."
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
