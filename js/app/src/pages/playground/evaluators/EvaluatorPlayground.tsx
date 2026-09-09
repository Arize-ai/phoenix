import { css } from "@emotion/react";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  commitMutation,
  graphql,
  useMutation,
  useRelayEnvironment,
} from "react-relay";
import { Group } from "react-resizable-panels";
import { useBlocker, useSearchParams } from "react-router";

import {
  Button,
  EmptyState,
  EmptyStateGraphic,
  Flex,
  Icon,
  Icons,
  PageHeader,
  Skeleton,
  View,
} from "@phoenix/components";
import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { CredentialsDropdown } from "@phoenix/pages/playground/PlaygroundCredentialsDropdown";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import { PlaygroundModeSelect } from "../PlaygroundModeSelect";
import type { EvaluatorPlaygroundPreviewMutation } from "./__generated__/EvaluatorPlaygroundPreviewMutation.graphql";
import type { EvaluatorPlaygroundReviewMutation } from "./__generated__/EvaluatorPlaygroundReviewMutation.graphql";
import type {
  CalibrationExample,
  CalibrationPrediction,
  CalibrationRun,
} from "./calibration";
import {
  createCalibrationContext,
  getCalibrationAnnotationName,
  haveCompatibleLabels,
  runCalibrationSample,
} from "./calibration";
import { CalibrationDataset } from "./CalibrationDataset";
import { CalibrationResults } from "./CalibrationResults";
import {
  CalibrationSettingsButton,
  DEFAULT_SAMPLE_SIZE,
  parseSampleSize,
} from "./CalibrationSettingsButton";
import { EvaluatorPlaygroundRunButton } from "./EvaluatorPlaygroundRunButton";
import { EvaluatorSlot } from "./EvaluatorSlot";
import type { SlotId, SlotSnapshot } from "./evaluatorSlotTypes";

const EMPTY_CONTEXT = { input: {}, output: {}, reference: {}, metadata: {} };

const playgroundWrapCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

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
  const environment = useRelayEnvironment();
  const credentials = useCredentialsContext((state) => state);
  const datasetId = searchParams.get("datasetId");
  const splitIds = searchParams.getAll("splitId");
  const versionId = searchParams.get("datasetVersionId");
  const hasComparison = searchParams.get("compare") === "true";
  const sampleSize = parseSampleSize(searchParams.get("sampleSize"));
  const [sampleGeneration, setSampleGeneration] = useState(0);
  const sampleKey = JSON.stringify([
    sampleGeneration,
    datasetId,
    splitIds,
    versionId,
    sampleSize,
  ]);
  const [sample, setSample] = useState<{
    key: string;
    examples: CalibrationExample[];
  } | null>(null);
  const examples =
    sample?.key === sampleKey ? sample.examples.slice(0, sampleSize) : [];
  const [slots, setSlots] = useState<Partial<Record<SlotId, SlotSnapshot>>>({});
  const [runs, setRuns] = useState<Partial<Record<SlotId, CalibrationRun>>>({});
  const controllers = useRef<Partial<Record<SlotId, AbortController>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<{
    example: CalibrationExample;
    label: string | null;
  } | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewLabel, isSavingReview] =
    useMutation<EvaluatorPlaygroundReviewMutation>(graphql`
      mutation EvaluatorPlaygroundReviewMutation(
        $input: SetDatasetExampleCalibrationLabelInput!
      ) {
        setDatasetExampleCalibrationLabel(input: $input) {
          revision {
            revisionId
            calibrationLabels {
              annotationName
              label
            }
          }
        }
      }
    `);
  const visibleSlotIds: SlotId[] = hasComparison ? ["A", "B"] : ["A"];
  const isRunning = visibleSlotIds.some((slotId) => runs[slotId]?.isRunning);
  const { labelName, labels, isCompatible, expected, currentRuns, staleSlots } =
    getCalibrationView({ slots, runs, examples, sampleKey, visibleSlotIds });
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const nextMode = new URLSearchParams(nextLocation.search).get("mode");
    const removesDirtyComparison =
      hasComparison &&
      new URLSearchParams(nextLocation.search).get("compare") !== "true" &&
      !!slots.B?.isDirty;
    return (
      removesDirtyComparison ||
      ((isRunning ||
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

  async function runSlots(slotIds: SlotId[]) {
    // Freeze every slot before the first request, and share one concurrency budget.
    const requests = slotIds.flatMap((slotId) => {
      const slot = slots[slotId];
      if (!slot?.preview || slot.validationError || !examples.length) return [];
      controllers.current[slotId]?.abort();
      const controller = new AbortController();
      controllers.current[slotId] = controller;
      setRuns((previous) => ({
        ...previous,
        [slotId]: {
          revision: slot.revision,
          sampleKey,
          predictions: {},
          total: examples.length,
          isRunning: true,
        },
      }));
      return examples.map((example) => ({ slotId, slot, controller, example }));
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
                annotation?.label == null ||
                !validLabels.includes(annotation.label)
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
      onResult({ slotId, controller, example }, prediction) {
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
                  predictions: { ...run.predictions, [example.id]: prediction },
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
            ? { ...previous, [slotId]: { ...run, isRunning: false } }
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
          { ...run, isRunning: false },
        ])
      )
    );
  }

  function saveReview(example: CalibrationExample, label: string | null) {
    if (!datasetId || !labelName || isSavingReview) return;
    setPendingReview({ example, label });
    setSavingId(example.id);
    setReviewError(null);
    reviewLabel({
      variables: {
        input: {
          datasetId,
          exampleId: example.id,
          expectedRevisionId: example.revisionId,
          annotationName: labelName,
          label,
        },
      },
      onCompleted(response, errors) {
        setSavingId(null);
        if (errors?.length) {
          setReviewError(errors.map((error) => error.message).join("\n"));
          return;
        }
        setPendingReview(null);
        setSample((previous) =>
          previous?.key === sampleKey
            ? {
                ...previous,
                examples: previous.examples.map((item) =>
                  item.id === example.id
                    ? {
                        ...item,
                        ...response.setDatasetExampleCalibrationLabel.revision,
                      }
                    : item
                ),
              }
            : previous
        );
      },
      onError(error) {
        setSavingId(null);
        setReviewError(
          getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            error.message
        );
      },
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
  const canRun =
    !!examples.length &&
    visibleSlotIds.every(
      (slotId) => !!slots[slotId]?.preview && !slots[slotId]?.validationError
    );

  return (
    <div css={playgroundWrapCSS}>
      <View borderBottomColor="default" borderBottomWidth="thin">
        <PageHeader
          title="Playground"
          subTitle={<PlaygroundModeSelect />}
          extra={
            <Flex direction="row" gap="size-100" alignItems="center">
              {providers.length ? (
                <CredentialsDropdown
                  providers={providers}
                  isDisabled={isRunning}
                />
              ) : null}
              <EvaluatorPlaygroundRunButton
                isRunning={isRunning}
                isDisabled={!canRun}
                onRun={() => void runSlots(visibleSlotIds)}
                onStop={stop}
              />
            </Flex>
          }
        />
      </View>
      <Group orientation="vertical" style={{ flex: 1, minHeight: 0 }}>
        <TitledPanel
          title="Evaluators"
          headingLevel={2}
          panelProps={{ defaultSize: 55, minSize: 15 }}
          extra={
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.PlusCircle />} />}
              isDisabled={isRunning || hasComparison}
              onPress={() => changeParam("compare", "true")}
            >
              Compare
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
                  <Suspense fallback={<Skeleton height={240} />}>
                    <EvaluatorSlot
                      slotId={slotId}
                      datasetId={datasetId}
                      initialEvaluatorId={searchParams.get(
                        `evaluator${slotId}`
                      )}
                      initialDatasetEvaluatorId={searchParams.get(
                        `datasetEvaluator${slotId}`
                      )}
                      sampleContext={
                        examples[0]
                          ? createCalibrationContext(examples[0])
                          : EMPTY_CONTEXT
                      }
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
                      onRun={
                        hasComparison
                          ? () => void runSlots([slotId])
                          : undefined
                      }
                      onRemove={
                        slotId === "B"
                          ? () => changeParam("compare", null)
                          : undefined
                      }
                      isRunning={!!runs[slotId]?.isRunning}
                      isRunDisabled={isRunning || !examples.length}
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
              <DatasetSelectWithSplits
                size="S"
                placeholder="Select a dataset"
                isDisabled={isRunning || isSavingReview}
                value={datasetId ? { datasetId, splitIds } : null}
                onSelectionChange={({
                  datasetId: nextDatasetId,
                  splitIds: nextSplits,
                }) => {
                  stop();
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
                      next.delete("datasetEvaluatorA");
                      next.delete("datasetEvaluatorB");
                    }
                    return next;
                  });
                }}
              />
              <CalibrationSettingsButton
                sampleSize={sampleSize}
                isDisabled={isRunning}
                onSampleSizeChange={(size) =>
                  changeParam(
                    "sampleSize",
                    size === DEFAULT_SAMPLE_SIZE ? null : String(size)
                  )
                }
              />
            </Flex>
          }
        >
          {datasetId ? (
            <Suspense fallback={<Skeleton height={160} />}>
              <CalibrationDataset
                key={sampleKey}
                fetchKey={sampleKey}
                datasetId={datasetId}
                first={sampleSize}
                splitIds={splitIds}
                versionId={versionId}
                onLoad={(loaded) =>
                  setSample({ key: sampleKey, examples: loaded })
                }
              />
            </Suspense>
          ) : null}
          {datasetId ? (
            <CalibrationResults
              examples={examples}
              sampleSize={sampleSize}
              runs={currentRuns}
              slotNames={{ A: slots.A?.name, B: slots.B?.name }}
              expected={expected}
              labels={labels}
              hasComparison={hasComparison}
              isCompatible={isCompatible}
              filter={searchParams.get("reviewFilter") ?? "all"}
              onFilterChange={(value) => changeParam("reviewFilter", value)}
              onReview={saveReview}
              savingId={savingId}
              reviewError={reviewError}
              onRetryReview={() => {
                if (pendingReview)
                  saveReview(pendingReview.example, pendingReview.label);
              }}
              onReloadSample={() => {
                stop();
                setReviewError(null);
                setPendingReview(null);
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
        message="Leave evaluator playground? Unsaved drafts and run results will be lost. Saved expected labels remain in the dataset."
      />
    </div>
  );
}

function getCalibrationView({
  slots,
  runs,
  examples,
  sampleKey,
  visibleSlotIds,
}: {
  slots: Partial<Record<SlotId, SlotSnapshot>>;
  runs: Partial<Record<SlotId, CalibrationRun>>;
  examples: CalibrationExample[];
  sampleKey: string;
  visibleSlotIds: SlotId[];
}) {
  const labelName = slots.A?.selectedOutputName ?? "";
  const labels =
    slots.A?.outputNames.find((output) => output.name === labelName)?.labels ??
    [];
  const otherLabels =
    slots.B?.outputNames.find(
      (output) => output.name === slots.B?.selectedOutputName
    )?.labels ?? [];
  const isCompatible = haveCompatibleLabels(labels, otherLabels);
  const expected: Partial<Record<string, string>> = {};
  for (const example of examples) {
    const label = example.calibrationLabels.find(
      (item) => item.annotationName === labelName
    )?.label;
    if (label != null && labels.includes(label)) expected[example.id] = label;
  }
  const currentRuns: Partial<Record<SlotId, CalibrationRun>> = {};
  for (const slotId of visibleSlotIds) {
    if (runs[slotId]?.sampleKey === sampleKey)
      currentRuns[slotId] = runs[slotId];
  }
  const staleSlots = visibleSlotIds.filter(
    (slotId) =>
      currentRuns[slotId] &&
      currentRuns[slotId]?.revision !== slots[slotId]?.revision
  );
  return { labelName, labels, isCompatible, expected, currentRuns, staleSlots };
}
