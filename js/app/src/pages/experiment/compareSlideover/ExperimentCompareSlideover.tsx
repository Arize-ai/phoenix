import { css } from "@emotion/react";
import type { FocusEvent, PointerEvent } from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Dialog,
  DialogCloseButton,
  Drawer,
  LinkButton,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  Text,
  TitleWithID,
} from "@phoenix/components";
import {
  DRAWER_DEFAULT_MIN_SIZE,
  useDefaultDrawerSize,
  useOverlayFrame,
} from "@phoenix/components/core/overlay";
import { ErrorBoundary } from "@phoenix/components/exception";
import { useExperimentColors } from "@phoenix/components/experiment";
import { indexAnnotationConfigsByName } from "@phoenix/components/experiment/experimentDeltaUtils";
import { ExampleDetailsPaginator } from "@phoenix/pages/experiment/ExampleDetailsPaginator";
import type { SelectedTraceDetails } from "@phoenix/pages/experiment/TraceDetailsDrawer";
import { datasetEvaluatorsToAnnotationConfigs } from "@phoenix/utils/datasetEvaluatorUtils";

import type { ExperimentCompareSlideoverQuery } from "./__generated__/ExperimentCompareSlideoverQuery.graphql";
import { getAnnotationNameUnion } from "./experimentCompareAnnotationRows";
import { ExperimentCompareDetailsSections } from "./ExperimentCompareDetailsSections";
import type { ExperimentCompareNavigationItem } from "./experimentCompareExampleNavigation";
import {
  findNavigationItemIndex,
  formatExamplePosition,
  resolveExampleNavigation,
} from "./experimentCompareExampleNavigation";
import { isArrowKeyConsumer } from "./experimentCompareHotkeyTarget";
import { ExperimentCompareLaneEmpty } from "./ExperimentCompareLaneEmpty";
import { ExperimentCompareLaneHeader } from "./ExperimentCompareLaneHeader";
import {
  EXPERIMENT_COMPARE_SLIDEOVER_CONTAINER_NAME,
  ExperimentCompareLaneRow,
  STACKED_LANES_CONTAINER_QUERY,
} from "./ExperimentCompareLaneRow";
import { resolveShownRepetitionNumber } from "./experimentCompareLaneRuns";
import { ExperimentCompareLaneTrace } from "./ExperimentCompareLaneTrace";
import type {
  CompareLane,
  CompareLaneSide,
} from "./experimentCompareLaneTypes";
import type {
  ExperimentCompareDetailsMode,
  ExperimentCompareSlideoverState,
} from "./experimentCompareSlideoverSearchParams";
import { resolveCompareLaneExperimentId } from "./experimentCompareSlideoverSearchParams";
import { useExperimentCompareSlideoverState } from "./useExperimentCompareSlideoverState";

type ExperimentCompareSlideoverProps = {
  datasetId: string;
  baseExperimentId: string;
  /** The compared experiments, in display order */
  compareExperimentIds: readonly string[];
  /** The loaded stops previous and next move through, in the table's order */
  navigationItems: readonly ExperimentCompareNavigationItem[];
  /** The server's count of stops; null when it is not known, as under a filter */
  totalItemCount: number | null;
  /** Whether the server has stops past the loaded ones */
  hasMoreItems: boolean;
  isLoadingMoreItems: boolean;
  onLoadMoreItems: () => void;
  onOpenTrace: (details: SelectedTraceDetails) => void;
  /**
   * Whether another overlay sits on top of the slideover, which then leaves
   * the keyboard to that overlay.
   */
  isObscured?: boolean;
};

/**
 * Options for the slideover's arrow shortcuts: off while another overlay has
 * the keyboard, and never taken from an element that uses arrow keys itself.
 * The event is ignored rather than the shortcut disabled, because a disabled
 * shortcut still cancels the key press for the rest of the page.
 */
function getArrowHotkeyOptions(areHotkeysEnabled: boolean) {
  return {
    ignoreEventWhen: (event: KeyboardEvent) =>
      !areHotkeysEnabled || isArrowKeyConsumer(event.target),
    preventDefault: true,
  };
}

const slideoverCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  container: ${EXPERIMENT_COMPARE_SLIDEOVER_CONTAINER_NAME} / inline-size;

  .experiment-compare-slideover__header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-100) var(--global-dimension-size-150);
    flex: none;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    border-bottom: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  .experiment-compare-slideover__position {
    font-family: var(--global-font-family-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .experiment-compare-slideover__header-end {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    margin-left: auto;
  }

  .experiment-compare-slideover__body {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }

  .experiment-compare-slideover__lane-headers {
    flex: none;
    border-bottom: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  /* Marks the lane the repetition shortcuts act on */
  .experiment-compare-slideover__body[data-active-lane="base"]
    .experiment-compare-slideover__lane-headers
    [data-lane="base"],
  .experiment-compare-slideover__body[data-active-lane="compare"]
    .experiment-compare-slideover__lane-headers
    [data-lane="compare"] {
    box-shadow: inset 0 calc(-1 * var(--global-border-size-thick)) 0
      var(--global-color-primary);
  }

  .experiment-compare-slideover__traces {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    .experiment-compare-lane-row {
      height: 100%;
      grid-template-rows: minmax(0, 1fr);
    }
    .experiment-compare-lane-row__cell {
      min-height: 0;
      overflow: hidden;
    }
  }

  ${STACKED_LANES_CONTAINER_QUERY} {
    .experiment-compare-slideover__traces {
      overflow-y: auto;
      .experiment-compare-lane-row {
        height: auto;
        grid-template-rows: none;
      }
      .experiment-compare-lane-row__cell {
        height: 70vh;
      }
    }
  }

  .experiment-compare-slideover__body-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-100);
  }
`;

/**
 * The two-lane experiment comparison for one example, docked to the right of
 * the compare table: the base experiment's runs on the left and one compared
 * experiment's on the right, as run details or as traces. It is open while
 * the URL names an example, and renders nothing otherwise.
 */
export function ExperimentCompareSlideover(
  props: ExperimentCompareSlideoverProps
) {
  const { state } = useExperimentCompareSlideoverState();
  if (state.selectedExampleId == null) {
    return null;
  }
  return (
    <OpenExperimentCompareSlideover
      {...props}
      selectedExampleId={state.selectedExampleId}
    />
  );
}

function OpenExperimentCompareSlideover({
  datasetId,
  baseExperimentId,
  compareExperimentIds,
  navigationItems,
  totalItemCount,
  hasMoreItems,
  isLoadingMoreItems,
  onLoadMoreItems,
  onOpenTrace,
  isObscured = false,
  selectedExampleId,
}: ExperimentCompareSlideoverProps & { selectedExampleId: string }) {
  const { state, updateState, openExample, closeSlideover } =
    useExperimentCompareSlideoverState();
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "experiment-compare-details",
  });
  const isViewportBlocked = useOverlayFrame()?.isViewportBlocked ?? false;
  const areHotkeysEnabled = !isObscured && !isViewportBlocked;

  const currentIndex = findNavigationItemIndex({
    items: navigationItems,
    selectedExampleId,
    baseRepetitionNumber: state.baseRepetitionNumber,
  });
  const currentItem = navigationItems[currentIndex];

  // The example next was pressed on while its neighbor was still on an
  // unfetched page. It is dropped as soon as another stop is opened.
  const pendingAdvanceRef = useRef<{
    fromIndex: number;
    exampleId: string;
  } | null>(null);

  const navigateToIndex = (targetIndex: number) => {
    const navigation = resolveExampleNavigation({
      items: navigationItems,
      targetIndex,
      hasMoreItems,
    });
    if (navigation.type === "none") {
      return;
    }
    const isAtLoadedEnd = targetIndex >= navigationItems.length - 1;
    if (isAtLoadedEnd && hasMoreItems && !isLoadingMoreItems) {
      onLoadMoreItems();
    }
    if (navigation.type === "select") {
      openExample(navigation.item);
    } else {
      pendingAdvanceRef.current = {
        fromIndex: targetIndex - 1,
        exampleId: selectedExampleId,
      };
    }
  };

  // The URL is the selection, and it can only move once the fetched page has
  // rendered, so this cannot be derived during render.
  useEffect(() => {
    const pendingAdvance = pendingAdvanceRef.current;
    if (pendingAdvance == null) {
      return;
    }
    if (
      pendingAdvance.exampleId !== selectedExampleId ||
      pendingAdvance.fromIndex !== currentIndex
    ) {
      pendingAdvanceRef.current = null;
      return;
    }
    const nextItem = navigationItems[pendingAdvance.fromIndex + 1];
    if (nextItem != null) {
      pendingAdvanceRef.current = null;
      openExample(nextItem);
    }
  }, [currentIndex, navigationItems, openExample, selectedExampleId]);

  const arrowHotkeyOptions = getArrowHotkeyOptions(areHotkeysEnabled);
  useHotkeys(
    "ArrowDown",
    () => navigateToIndex(currentIndex + 1),
    arrowHotkeyOptions
  );
  useHotkeys(
    "ArrowUp",
    () => navigateToIndex(currentIndex - 1),
    arrowHotkeyOptions
  );

  return (
    <Drawer
      isOpen
      onClose={() => {
        if (!isObscured) {
          closeSlideover();
        }
      }}
      defaultSize={defaultSize}
      minSize={DRAWER_DEFAULT_MIN_SIZE}
      onResize={onSizeChange}
    >
      <Dialog aria-label="Experiment run comparison">
        <div className="experiment-compare-slideover" css={slideoverCSS}>
          <header className="experiment-compare-slideover__header">
            <DialogCloseButton
              close={closeSlideover}
              aria-label="Close comparison"
            />
            <ExampleDetailsPaginator
              currentExampleIndex={currentIndex}
              exampleIds={navigationItems.map((item) => item.exampleId)}
              onExampleChange={navigateToIndex}
              hasMoreExamples={hasMoreItems}
              isLoadingMoreExamples={isLoadingMoreItems}
              areHotkeysEnabled={areHotkeysEnabled}
            />
            <TitleWithID
              title="Example"
              id={currentItem?.exampleExternalId ?? selectedExampleId}
            />
            <Text
              className="experiment-compare-slideover__position"
              size="S"
              color="text-500"
            >
              {formatExamplePosition({
                currentIndex,
                loadedCount: navigationItems.length,
                totalCount: totalItemCount,
                hasMoreItems,
              })}
            </Text>
            <div className="experiment-compare-slideover__header-end">
              <LinkButton
                size="S"
                to={`/datasets/${datasetId}/examples/${selectedExampleId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Example
              </LinkButton>
              <SegmentedControl
                aria-label="View"
                size="S"
                selectedKey={state.mode}
                onSelectionChange={(mode) =>
                  updateState({
                    changes: { mode: mode as ExperimentCompareDetailsMode },
                  })
                }
              >
                <SegmentedControlItem id="details">
                  Details
                </SegmentedControlItem>
                <SegmentedControlItem id="traces">Traces</SegmentedControlItem>
              </SegmentedControl>
            </div>
          </header>
          {/* Keyed so that opening another example or changing the experiments
              leaves a failed load behind */}
          <ErrorBoundary
            key={[
              selectedExampleId,
              baseExperimentId,
              ...compareExperimentIds,
            ].join(":")}
          >
            <Suspense fallback={<ExperimentCompareSlideoverBodySkeleton />}>
              <ExperimentCompareSlideoverBody
                datasetId={datasetId}
                exampleId={selectedExampleId}
                baseExperimentId={baseExperimentId}
                compareExperimentIds={compareExperimentIds}
                state={state}
                onStateChange={(changes) => updateState({ changes })}
                onOpenTrace={onOpenTrace}
                areHotkeysEnabled={areHotkeysEnabled}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </Dialog>
    </Drawer>
  );
}

function ExperimentCompareSlideoverBodySkeleton() {
  return (
    <div
      className="experiment-compare-slideover__body-skeleton"
      aria-busy="true"
    >
      <Skeleton height={32} />
      <Skeleton height={160} />
      <Skeleton height={240} />
    </div>
  );
}

function ExperimentCompareSlideoverBody({
  datasetId,
  exampleId,
  baseExperimentId,
  compareExperimentIds,
  state,
  onStateChange,
  onOpenTrace,
  areHotkeysEnabled,
}: {
  datasetId: string;
  exampleId: string;
  baseExperimentId: string;
  compareExperimentIds: readonly string[];
  state: ExperimentCompareSlideoverState;
  onStateChange: (changes: Partial<ExperimentCompareSlideoverState>) => void;
  onOpenTrace: (details: SelectedTraceDetails) => void;
  areHotkeysEnabled: boolean;
}) {
  const data = useLazyLoadQuery<ExperimentCompareSlideoverQuery>(
    graphql`
      query ExperimentCompareSlideoverQuery(
        $datasetId: ID!
        $experimentIds: [ID!]!
      ) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            experiments(filterIds: $experimentIds, includeEphemeral: true) {
              edges {
                experiment: node {
                  id
                  name
                  sequenceNumber
                  repetitions
                  metadata
                  datasetVersion {
                    id
                  }
                  annotationSummaries {
                    annotationName
                    minScore
                    maxScore
                  }
                }
              }
            }
            datasetEvaluators(first: 100) {
              edges {
                node {
                  name
                  outputConfigs {
                    __typename
                    ... on CategoricalAnnotationConfig {
                      name
                      optimizationDirection
                      values {
                        label
                        score
                      }
                    }
                    ... on ContinuousAnnotationConfig {
                      name
                      optimizationDirection
                      lowerBound
                      upperBound
                    }
                    ... on FreeformAnnotationConfig {
                      name
                      optimizationDirection
                      threshold
                      lowerBound
                      upperBound
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { datasetId, experimentIds: [baseExperimentId, ...compareExperimentIds] }
  );
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  const [activeLaneSide, setActiveLaneSide] = useState<CompareLaneSide>("base");

  const experiments =
    data.dataset.experiments?.edges.map((edge) => edge.experiment) ?? [];
  const baseExperiment = experiments.find(
    (experiment) => experiment.id === baseExperimentId
  );
  const compareExperiments = compareExperimentIds.flatMap(
    (experimentId) =>
      experiments.find((experiment) => experiment.id === experimentId) ?? []
  );
  const compareExperimentId = resolveCompareLaneExperimentId({
    requestedExperimentId: state.compareLaneExperimentId,
    compareExperimentIds: compareExperiments.map((experiment) => experiment.id),
  });
  const compareExperiment = compareExperiments.find(
    (experiment) => experiment.id === compareExperimentId
  );
  const getCompareExperimentColor = (experimentId: string) =>
    getExperimentColor(compareExperimentIds.indexOf(experimentId));

  const lanes: CompareLane[] = [];
  if (baseExperiment != null) {
    lanes.push({
      side: "base",
      experiment: baseExperiment,
      color: baseExperimentColor,
      shownRepetitionNumber: resolveShownRepetitionNumber({
        requestedRepetitionNumber: state.baseRepetitionNumber,
        repetitionCount: baseExperiment.repetitions,
      }),
    });
    if (compareExperiment != null) {
      lanes.push({
        side: "compare",
        experiment: compareExperiment,
        color: getCompareExperimentColor(compareExperiment.id),
        shownRepetitionNumber: resolveShownRepetitionNumber({
          requestedRepetitionNumber: state.compareRepetitionNumber,
          repetitionCount: compareExperiment.repetitions,
        }),
      });
    }
  }
  const activeLane =
    lanes.find((lane) => lane.side === activeLaneSide) ?? lanes[0];

  const setLaneRepetitionNumber = ({
    side,
    repetitionNumber,
  }: {
    side: CompareLaneSide;
    repetitionNumber: number;
  }) => {
    onStateChange(
      side === "base"
        ? { baseRepetitionNumber: repetitionNumber }
        : { compareRepetitionNumber: repetitionNumber }
    );
  };

  const stepActiveLaneRepetition = (step: 1 | -1) => {
    if (activeLane == null) {
      return;
    }
    const repetitionNumber = resolveShownRepetitionNumber({
      requestedRepetitionNumber: activeLane.shownRepetitionNumber + step,
      repetitionCount: activeLane.experiment.repetitions,
    });
    if (repetitionNumber !== activeLane.shownRepetitionNumber) {
      setLaneRepetitionNumber({ side: activeLane.side, repetitionNumber });
    }
  };

  const arrowHotkeyOptions = getArrowHotkeyOptions(areHotkeysEnabled);
  useHotkeys(
    "ArrowRight",
    () => stepActiveLaneRepetition(1),
    arrowHotkeyOptions
  );
  useHotkeys(
    "ArrowLeft",
    () => stepActiveLaneRepetition(-1),
    arrowHotkeyOptions
  );

  if (baseExperiment == null) {
    return (
      <div className="experiment-compare-slideover__body-skeleton">
        <ExperimentCompareLaneEmpty message="The base experiment could not be found" />
      </div>
    );
  }

  const activateLaneOfEvent = (
    event: FocusEvent<HTMLElement> | PointerEvent<HTMLElement>
  ) => {
    const side = (event.target as Element)
      .closest("[data-lane]")
      ?.getAttribute("data-lane");
    if (side === "base" || side === "compare") {
      setActiveLaneSide(side);
    }
  };

  const pickerOptions = compareExperiments.map((experiment) => ({
    id: experiment.id,
    name: experiment.name,
    sequenceNumber: experiment.sequenceNumber,
    color: getCompareExperimentColor(experiment.id),
  }));
  const hasSteppableLanes =
    lanes.length > 1 && lanes.some((lane) => lane.experiment.repetitions > 1);

  return (
    <div
      className="experiment-compare-slideover__body"
      data-active-lane={hasSteppableLanes ? activeLane?.side : undefined}
      onFocusCapture={activateLaneOfEvent}
      onPointerDownCapture={activateLaneOfEvent}
    >
      <ExperimentCompareLaneRow
        lanes={lanes}
        className="experiment-compare-slideover__lane-headers"
      >
        {(lane) => (
          <ExperimentCompareLaneHeader
            exampleId={exampleId}
            lane={lane}
            pickerOptions={pickerOptions}
            onCompareExperimentChange={(experimentId) =>
              onStateChange({
                compareLaneExperimentId: experimentId,
                compareRepetitionNumber: 1,
              })
            }
            onRepetitionNumberChange={(repetitionNumber) =>
              setLaneRepetitionNumber({ side: lane.side, repetitionNumber })
            }
            onViewRunTrace={
              state.mode === "details"
                ? () => onStateChange({ mode: "traces" })
                : undefined
            }
          />
        )}
      </ExperimentCompareLaneRow>
      {state.mode === "details" ? (
        <ExperimentCompareDetailsSections
          exampleId={exampleId}
          datasetVersionId={baseExperiment.datasetVersion.id}
          lanes={lanes}
          annotationNames={getAnnotationNameUnion(
            lanes.map((lane) =>
              lane.experiment.annotationSummaries.map(
                (summary) => summary.annotationName
              )
            )
          )}
          annotationConfigsByName={indexAnnotationConfigsByName(
            datasetEvaluatorsToAnnotationConfigs(
              data.dataset.datasetEvaluators?.edges.map((edge) => edge.node) ??
                []
            )
          )}
          onOpenTrace={onOpenTrace}
        />
      ) : (
        <div className="experiment-compare-slideover__traces">
          <ExperimentCompareLaneRow lanes={lanes}>
            {(lane) => (
              <Suspense
                key={`${exampleId}:${lane.experiment.id}`}
                fallback={
                  <div
                    className="experiment-compare-slideover__body-skeleton"
                    aria-busy="true"
                  >
                    <Skeleton height={240} />
                  </div>
                }
              >
                <ExperimentCompareLaneTrace
                  exampleId={exampleId}
                  lane={lane}
                  isActive={lane.side === activeLane?.side}
                />
              </Suspense>
            )}
          </ExperimentCompareLaneRow>
        </div>
      )}
    </div>
  );
}
