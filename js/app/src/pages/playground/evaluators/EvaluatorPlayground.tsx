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
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { CredentialsDropdown } from "@phoenix/pages/playground/PlaygroundCredentialsDropdown";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { EvaluatorPlaygroundPreviewMutation } from "./__generated__/EvaluatorPlaygroundPreviewMutation.graphql";
import type { EvaluatorPlaygroundReviewMutation } from "./__generated__/EvaluatorPlaygroundReviewMutation.graphql";
import type {
  CalibrationExample,
  CalibrationPrediction,
  CalibrationRun,
  ExpectedOutput,
  SlotExpectations,
} from "./calibration";
import {
  createCalibrationContext,
  getCalibrationAnnotationName,
  runCalibrationSample,
} from "./calibration";
import { CalibrationDataset } from "./CalibrationDataset";
import { CalibrationResults } from "./CalibrationResults";
import {
  CalibrationSettingsButton,
  DEFAULT_SAMPLE_SIZE,
  parseSampleSize,
} from "./CalibrationSettingsButton";
import { EvaluatorPlaygroundFrame } from "./EvaluatorPlaygroundFrame";
import { EvaluatorPlaygroundRunButton } from "./EvaluatorPlaygroundRunButton";
import { EvaluatorSlot } from "./EvaluatorSlot";
import {
  EVALUATOR_SLOT_IDS,
  getVisibleEvaluatorSlots,
  setVisibleEvaluatorSlots,
} from "./evaluatorSlotTypes";
import type { SlotId, SlotSnapshot } from "./evaluatorSlotTypes";
import type { PendingExpectedOutputs } from "./expectedOutputQueue";
import { useExpectedOutputQueue } from "./expectedOutputQueue";
import { useEvaluatorWorkspaceOperations } from "./useEvaluatorWorkspaceOperations";

const EMPTY_CONTEXT = { input: {}, output: {}, reference: {}, metadata: {} };

type ExpectedOutputLabelInput =
  EvaluatorPlaygroundReviewMutation["variables"]["input"]["labels"][number];

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

const EMPTY_EXAMPLES: CalibrationExample[] = [];

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
  const datasetId = searchParams.get("datasetId");
  const splitIds = searchParams.getAll("splitId");
  const versionId = searchParams.get("datasetVersionId");
  const visibleSlotIds = getVisibleEvaluatorSlots(searchParams);
  const hasComparison = visibleSlotIds.length > 1;
  const sampleSize = parseSampleSize(searchParams.get("sampleSize"));
  const [sampleGeneration, setSampleGeneration] = useState(0);
  const sampleScope = JSON.stringify([
    sampleGeneration,
    datasetId,
    splitIds,
    versionId,
  ]);
  const sampleKey = JSON.stringify([sampleScope, sampleSize]);
  const [sample, setSample] = useState<{
    key: string;
    scope: string;
    examples: CalibrationExample[];
  } | null>(null);
  const isSampleLoading = datasetId != null && sample?.key !== sampleKey;
  // Keep the displayed sample mounted while a size change loads. Execution and
  // review still require the requested sample, and a different dataset/split/
  // version must never display rows from the previous scope.
  const displayedExamples =
    sample?.scope === sampleScope ? sample.examples : EMPTY_EXAMPLES;
  const examples = isSampleLoading ? EMPTY_EXAMPLES : displayedExamples;
  const sampleContext = displayedExamples[0]
    ? createCalibrationContext(displayedExamples[0])
    : EMPTY_CONTEXT;
  const [slots, setSlots] = useState<Partial<Record<SlotId, SlotSnapshot>>>({});
  const [runs, setRuns] = useState<Partial<Record<SlotId, CalibrationRun>>>({});
  const controllers = useRef<Partial<Record<SlotId, AbortController>>>({});
  // Annotations are written in batches (see expectedOutputQueue). The flush reads
  // the sample through this ref so a timer firing later still resolves each
  // example's current revision, not the one it had when annotated.
  const latestSample = useRef({ datasetId, examples: displayedExamples });
  useEffect(() => {
    latestSample.current = { datasetId, examples: displayedExamples };
  });
  const annotations = useExpectedOutputQueue(flushExpectedOutputs);
  const isRunning = visibleSlotIds.some((slotId) => runs[slotId]?.isRunning);
  const { expected, currentRuns, staleSlots } = getCalibrationView({
    slots,
    runs,
    examples,
    sampleKey,
    visibleSlotIds,
    overlay: annotations.overlay,
  });
  const { registerAgentSlot, allowNavigation } =
    useEvaluatorWorkspaceOperations({
      datasetId,
      versionId,
      splitIds,
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
      isSavingReview: annotations.isSaving,
      runSlots,
      stop,
      saveReview,
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
        annotations.pendingCount > 0 ||
        annotations.isSaving ||
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

  /**
   * Run the given slots over the sample, or over just the given examples. A
   * whole-column run starts that column over; a row run keeps the column's
   * other results and replaces only the targeted rows.
   */
  async function runSlots(slotIds: SlotId[], exampleIds?: readonly string[]) {
    const targets = exampleIds
      ? examples.filter((example) => exampleIds.includes(example.id))
      : examples;
    const targetIds = new Set(targets.map((example) => example.id));
    // Freeze every slot before the first request, and share one concurrency budget.
    const requests = slotIds.flatMap((slotId) => {
      const slot = slots[slotId];
      if (!slot?.preview || slot.validationError || !targets.length) return [];
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
      return targets.map((example) => ({ slotId, slot, controller, example }));
    });
    await runCalibrationSample({
      items: requests,
      signal: new AbortController().signal,
      execute: async ({ slot, controller, example }) => {
        if (controller.signal.aborted)
          return { status: "error", error: "Stopped" };
        return new Promise<CalibrationPrediction>((resolve) => {
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
                    evaluator: slot.preview!,
                    context: createCalibrationContext(example),
                    inputMapping: slot.inputMapping,
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
              const results = response.evaluatorPreviews.results;
              const outputCount =
                slot.preview?.inlineLlmEvaluator?.outputConfigs.length ??
                slot.preview?.inlineCodeEvaluator?.outputConfigs.length ??
                1;
              const annotationName = getCalibrationAnnotationName({
                evaluatorName: slot.name,
                outputName: slot.selectedOutputName,
                outputCount,
              });
              const result = results.find(
                (item) => item.annotation?.name === annotationName
              );
              const annotation = result?.annotation;
              const validLabels =
                slot.outputNames.find(
                  (output) => output.name === slot.selectedOutputName
                )?.labels ?? [];
              if (
                !annotation ||
                (validLabels.length > 0 &&
                  !validLabels.includes(annotation.label ?? ""))
              ) {
                resolve({
                  status: "error",
                  error:
                    result?.error ??
                    results.find((item) => item.error)?.error ??
                    "Evaluator did not return a label from the selected output.",
                });
              } else
                resolve({
                  status: "success",
                  label: annotation.label,
                  explanation: annotation.explanation,
                  score: annotation.score,
                });
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
  async function saveReview(
    example: CalibrationExample,
    slotId: SlotId,
    output: ExpectedOutput | null,
    { immediate = false }: { immediate?: boolean } = {}
  ): Promise<UIOperationResult> {
    const slot = slots[slotId];
    const labelName = slot
      ? getCalibrationAnnotationName({
          evaluatorName: slot.name,
          outputName: slot.selectedOutputName,
          outputCount: slot.outputNames.length,
        })
      : null;
    if (!datasetId || !labelName || isSampleLoading)
      return {
        ok: false,
        error: "Wait for the dataset and output to load before annotating.",
      };
    if (!examples.some((current) => current.id === example.id))
      return {
        ok: false,
        error:
          "This example is no longer in the current sample. Load it again before annotating.",
      };
    annotations.enqueue(example.id, labelName, output);
    return immediate ? annotations.flushNow() : { ok: true };
  }

  /** One mutation, one dataset version, for every annotation in the batch. */
  function flushExpectedOutputs(
    batch: PendingExpectedOutputs
  ): Promise<UIOperationResult> {
    const { datasetId: currentDatasetId, examples: currentExamples } =
      latestSample.current;
    if (!currentDatasetId)
      return Promise.resolve({ ok: false, error: "No dataset is selected." });
    const labels: ExpectedOutputLabelInput[] = [];
    for (const [exampleId, byName] of Object.entries(batch)) {
      const example = currentExamples.find((item) => item.id === exampleId);
      if (!example)
        return Promise.resolve({
          ok: false,
          error:
            "An annotated example is no longer in the sample. Load the latest sample and try again.",
        });
      for (const [annotationName, output] of Object.entries(byName))
        labels.push({
          exampleId,
          expectedRevisionId: example.revisionId,
          annotationName,
          label: output?.label ?? null,
          score: output?.score ?? null,
          explanation: output?.explanation ?? null,
        });
    }
    if (!labels.length) return Promise.resolve({ ok: true });
    return new Promise((resolve) => {
      commitMutation<EvaluatorPlaygroundReviewMutation>(environment, {
        mutation: graphql`
          mutation EvaluatorPlaygroundReviewMutation(
            $input: SetDatasetExampleCalibrationLabelsInput!
          ) {
            setDatasetExampleCalibrationLabels(input: $input) {
              examples {
                id
                revision {
                  revisionId
                  calibrationLabels {
                    annotationName
                    score
                    explanation
                    label
                  }
                }
              }
            }
          }
        `,
        variables: { input: { datasetId: currentDatasetId, labels } },
        onCompleted(response, errors) {
          if (errors?.length) {
            resolve({
              ok: false,
              error: errors.map((error) => error.message).join("\n"),
            });
            return;
          }
          const saved = new Map(
            response.setDatasetExampleCalibrationLabels.examples.map((item) => [
              item.id,
              item.revision,
            ])
          );
          // Fold the new revisions into the sample so later annotations on these
          // examples carry the right expected revision.
          setSample((previous) =>
            previous
              ? {
                  ...previous,
                  examples: previous.examples.map((item) => {
                    const revision = saved.get(item.id);
                    return revision ? { ...item, ...revision } : item;
                  }),
                }
              : previous
          );
          resolve({ ok: true, output: { saved: saved.size } });
        },
        onError(error) {
          resolve({
            ok: false,
            error:
              getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
              error.message,
          });
        },
      });
    });
  }

  // The providers the LLM slots are configured to call, so the API Keys
  // dropdown offers exactly the credential fields those runs will need.
  const providers = Array.from(
    new Set(
      visibleSlotIds.flatMap((slotId) => {
        const provider =
          slots[slotId]?.preview?.inlineLlmEvaluator?.promptVersion
            .modelProvider;
        return provider != null && isModelProvider(provider) ? [provider] : [];
      })
    )
  );
  // Slots whose draft is complete enough to execute. Run all and a row's play
  // button need every visible slot ready; a column's play needs only its own.
  const runnableSlots = visibleSlotIds.filter(
    (slotId) => !!slots[slotId]?.preview && !slots[slotId]?.validationError
  );
  const canRun =
    !!examples.length && runnableSlots.length === visibleSlotIds.length;

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
                      datasetId={datasetId}
                      initialEvaluatorId={searchParams.get(
                        `evaluator${slotId}`
                      )}
                      initialDatasetEvaluatorId={searchParams.get(
                        `datasetEvaluator${slotId}`
                      )}
                      sampleContext={sampleContext}
                      onChange={(snapshot) =>
                        setSlots((previous) =>
                          previous[slotId]?.revision === snapshot.revision &&
                          previous[slotId]?.validationError ===
                            snapshot.validationError &&
                          previous[slotId]?.isDirty === snapshot.isDirty
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
                                next.delete(`evaluator${slotId}`);
                                next.delete(`datasetEvaluator${slotId}`);
                                return next;
                              })
                          : undefined
                      }
                      isRunning={!!runs[slotId]?.isRunning}
                      onSelectionChange={({
                        evaluatorId,
                        datasetEvaluatorId,
                      }) =>
                        setSearchParams((previous) => {
                          const next = new URLSearchParams(previous);
                          next.delete(`evaluator${slotId}`);
                          next.delete(`datasetEvaluator${slotId}`);
                          if (evaluatorId)
                            next.set(`evaluator${slotId}`, evaluatorId);
                          if (datasetEvaluatorId)
                            next.set(
                              `datasetEvaluator${slotId}`,
                              datasetEvaluatorId
                            );
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
            <Flex direction="row" alignItems="center" gap="size-100">
              <Suspense fallback={<Loading size="S" />}>
                <DatasetSelectWithSplits
                  size="S"
                  placeholder="Select a dataset"
                  isDisabled={isRunning}
                  value={datasetId ? { datasetId, splitIds } : null}
                  onSelectionChange={({
                    datasetId: nextDatasetId,
                    splitIds: nextSplits,
                  }) => {
                    stop();
                    // Annotations are resolved against the sample they were made
                    // on, so write them before it goes away.
                    void annotations.flushNow();
                    setSearchParams((previous) => {
                      const next = new URLSearchParams(previous);
                      next.delete("datasetId");
                      next.delete("splitId");
                      next.delete("datasetVersionId");
                      if (nextDatasetId) next.set("datasetId", nextDatasetId);
                      nextSplits.forEach((splitId) =>
                        next.append("splitId", splitId)
                      );
                      if (nextDatasetId !== datasetId) {
                        EVALUATOR_SLOT_IDS.forEach((slot) =>
                          next.delete(`datasetEvaluator${slot}`)
                        );
                      }
                      return next;
                    });
                  }}
                />
              </Suspense>
              <CalibrationSettingsButton
                sampleSize={sampleSize}
                hideExpectedAnnotations={hideExpectedAnnotations}
                onHideExpectedAnnotationsChange={setHideExpectedAnnotations}
                isDisabled={isRunning}
                onSampleSizeChange={(size) => {
                  void annotations.flushNow();
                  changeParam(
                    "sampleSize",
                    size === DEFAULT_SAMPLE_SIZE ? null : String(size)
                  );
                }}
              />
            </Flex>
          }
        >
          {datasetId ? (
            <Suspense key={sampleKey} fallback={null}>
              <CalibrationDataset
                fetchKey={sampleKey}
                datasetId={datasetId}
                first={sampleSize}
                splitIds={splitIds}
                versionId={versionId}
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
          {datasetId ? (
            <CalibrationResults
              examples={examples}
              isLoading={isSampleLoading}
              sampleSize={sampleSize}
              runs={currentRuns}
              slots={slots}
              visibleSlotIds={visibleSlotIds}
              expected={expected}
              filter={searchParams.get("resultFilter") ?? "all"}
              onFilterChange={(value) => changeParam("resultFilter", value)}
              onReview={saveReview}
              isRunning={isRunning}
              runnableSlots={runnableSlots}
              onRunSlot={(slot) => void runSlots([slot])}
              onRunExample={(exampleId) =>
                void runSlots(visibleSlotIds, [exampleId])
              }
              hideExpectedAnnotations={hideExpectedAnnotations}
              saveStatus={annotations.status}
              pendingCount={annotations.pendingCount}
              reviewError={annotations.error}
              onRetryReview={() => void annotations.flushNow()}
              onReloadSample={() => {
                stop();
                changeParam("datasetVersionId", null);
                setSampleGeneration((generation) => generation + 1);
              }}
              staleSlots={staleSlots}
            />
          ) : (
            <Flex
              direction="column"
              alignItems="center"
              justifyContent="center"
              height="100%"
            >
              <View padding="size-400">
                <EmptyState
                  graphic={<EmptyStateGraphic variant="dataset" />}
                  title="Select a dataset"
                  description="Evaluators run over the first examples of a dataset. Each example's output is the response being judged; use a slot's input mapping to judge another field."
                />
              </View>
            </Flex>
          )}
        </TitledPanel>
      </Group>
      <ConfirmNavigationDialog
        blocker={blocker}
        message="Leave evaluator playground? Unsaved drafts and run results will be lost. Unsaved annotations are written to the dataset on the way out."
      />
    </EvaluatorPlaygroundFrame>
  );
}

function getCalibrationView({
  slots,
  runs,
  examples,
  sampleKey,
  visibleSlotIds,
  overlay,
}: {
  slots: Partial<Record<SlotId, SlotSnapshot>>;
  runs: Partial<Record<SlotId, CalibrationRun>>;
  examples: CalibrationExample[];
  sampleKey: string;
  visibleSlotIds: SlotId[];
  /** Annotations not yet confirmed by the server; they win over the dataset. */
  overlay: PendingExpectedOutputs;
}) {
  const expected: SlotExpectations = {};
  for (const slotId of visibleSlotIds) {
    const slot = slots[slotId];
    if (!slot) continue;
    const name = getCalibrationAnnotationName({
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
  const currentRuns: Partial<Record<SlotId, CalibrationRun>> = {};
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
