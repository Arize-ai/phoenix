import { css } from "@emotion/react";
import type { FocusEvent, PointerEvent } from "react";
import { Suspense, useEffect, useRef, useState } from "react";
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
import { HotkeysEnabledProvider } from "@phoenix/contexts/HotkeysEnabledContext";
import { useScopedHotkeys } from "@phoenix/hooks/useScopedHotkeys";
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
  CompareLaneLiveRuns,
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
  /** Null while the caller has no base experiment to show, as before a first run */
  baseExperimentId: string | null;
  /** The compared experiments, in display order */
  compareExperimentIds: readonly string[];
  /**
   * The open example's runs that are still coming in, by experiment. Omitted
   * when every experiment is finished.
   */
  liveRunsByExperimentId?: Partial<Record<string, CompareLaneLiveRuns>>;
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
 * Options for the slideover's arrow shortcuts, which are never taken from an
 * element that uses arrow keys itself.
 */
const ARROW_HOTKEY_OPTIONS = {
  ignoreEventWhen: (event: KeyboardEvent) => isArrowKeyConsumer(event.target),
  preventDefault: true,
};

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

  /* A long example ID truncates instead of crowding out the header */
  .experiment-compare-slideover__title {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 40ch;
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

  /* Details mode scrolls under the lane headers. Both reserve the scrollbar's
     width so the lanes keep the same width above and below. */
  .experiment-compare-slideover__body[data-mode="details"]
    .experiment-compare-slideover__lane-headers {
    overflow: hidden;
    scrollbar-gutter: stable;
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
 * the URL names an example, and renders nothing otherwise. Its shortcuts
 * are off while another overlay has the keyboard.
 */
export function ExperimentCompareSlideover(
  props: ExperimentCompareSlideoverProps
) {
  const { state } = useExperimentCompareSlideoverState();
  const isViewportBlocked = useOverlayFrame()?.isViewportBlocked ?? false;
  if (state.selectedExampleId == null) {
    return null;
  }
  return (
    <HotkeysEnabledProvider isEnabled={!props.isObscured && !isViewportBlocked}>
      <OpenExperimentCompareSlideover
        {...props}
        selectedExampleId={state.selectedExampleId}
      />
    </HotkeysEnabledProvider>
  );
}

function OpenExperimentCompareSlideover({
  datasetId,
  baseExperimentId,
  compareExperimentIds,
  liveRunsByExperimentId,
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

  useScopedHotkeys(
    "ArrowDown",
    () => navigateToIndex(currentIndex + 1),
    ARROW_HOTKEY_OPTIONS
  );
  useScopedHotkeys(
    "ArrowUp",
    () => navigateToIndex(currentIndex - 1),
    ARROW_HOTKEY_OPTIONS
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
            />
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
              <SegmentedControlItem id="details">Details</SegmentedControlItem>
              <SegmentedControlItem id="traces">Traces</SegmentedControlItem>
            </SegmentedControl>
            <div className="experiment-compare-slideover__title">
              <TitleWithID
                title="Example"
                id={currentItem?.exampleExternalId ?? selectedExampleId}
              />
            </div>
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
              >
                View Example
              </LinkButton>
            </div>
          </header>
          {baseExperimentId != null ? (
            <ErrorBoundary
              resetKey={[
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
                  liveRunsByExperimentId={liveRunsByExperimentId}
                  state={state}
                  onStateChange={(changes) => updateState({ changes })}
                  onOpenTrace={onOpenTrace}
                />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <div className="experiment-compare-slideover__body-skeleton">
              <ExperimentCompareLaneEmpty message="The base experiment has not run yet" />
            </div>
          )}
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
  liveRunsByExperimentId,
  state,
  onStateChange,
  onOpenTrace,
}: {
  datasetId: string;
  exampleId: string;
  baseExperimentId: string;
  compareExperimentIds: readonly string[];
  liveRunsByExperimentId?: Partial<Record<string, CompareLaneLiveRuns>>;
  state: ExperimentCompareSlideoverState;
  onStateChange: (changes: Partial<ExperimentCompareSlideoverState>) => void;
  onOpenTrace: (details: SelectedTraceDetails) => void;
}) {
  const experimentIds = [baseExperimentId, ...compareExperimentIds];
  // An experiment's repetitions and annotation names are only known in full
  // once it finishes, so they are read again as its runs come in.
  const liveFetchKey = experimentIds
    .flatMap((experimentId) => {
      const fetchKey = liveRunsByExperimentId?.[experimentId]?.fetchKey;
      return fetchKey != null ? [`${experimentId}:${fetchKey}`] : [];
    })
    .join("|");
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
    { datasetId, experimentIds },
    liveFetchKey !== ""
      ? { fetchKey: liveFetchKey, fetchPolicy: "store-and-network" }
      : undefined
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
      liveRuns: liveRunsByExperimentId?.[baseExperiment.id],
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
        liveRuns: liveRunsByExperimentId?.[compareExperiment.id],
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

  useScopedHotkeys(
    "ArrowRight",
    () => stepActiveLaneRepetition(1),
    ARROW_HOTKEY_OPTIONS
  );
  useScopedHotkeys(
    "ArrowLeft",
    () => stepActiveLaneRepetition(-1),
    ARROW_HOTKEY_OPTIONS
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
      data-mode={state.mode}
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
