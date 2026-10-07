import { css } from "@emotion/react";
import { useMemo } from "react";
import { Pressable } from "react-aria";

import {
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Popover,
  PopoverArrow,
  RichTooltip,
  RichTooltipDescription,
  RichTooltipTitle,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import {
  type Annotation,
  type AnnotationConfig,
  getOptimizationBounds,
  getPositiveOptimizationFromConfig,
} from "@phoenix/components/annotation";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
import { Skeleton } from "@phoenix/components/core/loading";
import type { ExecutionState } from "@phoenix/components/core/types";
import { ExperimentAnnotationButton } from "@phoenix/components/experiment/ExperimentAnnotationButton";
import { ExperimentRunAnnotationFiltersList } from "@phoenix/pages/experiment/ExperimentRunAnnotationFiltersList";
import { assertUnreachable } from "@phoenix/typeUtils";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  computeLabelDelta,
  computeMetricDelta,
  indexSummariesByAnnotationName,
} from "./experimentDeltaUtils";
import {
  ExperimentLabelDelta,
  ExperimentMetricDelta,
} from "./ExperimentMetricDelta";

const listCSS = css`
  display: flex;
  flex-direction: column;
  padding: var(--global-dimension-size-100);
  border-top: var(--global-border-size-thin) solid var(--global-color-gray-100);
  background-color: var(--global-color-gray-50);
`;

const listItemCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-height: 32px;
`;

const placeholderButtonCSS = css`
  flex: 1 1 auto;
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
  min-width: 0;
`;

const errorButtonCSS = css`
  flex: 1 1 auto;
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
  border-radius: var(--global-rounding-small);
  text-align: left;
  min-width: 0;
  &:hover {
    background-color: var(--global-color-gray-200);
  }
`;

const nameTextCSS = css`
  min-width: 5rem;
`;

type AnnotationSummary = {
  readonly annotationName: string;
  readonly meanScore: number | null;
};

export type AnnotationWithTrace = Annotation & {
  trace?: {
    traceId: string;
    projectId: string;
  } | null;
};

/**
 * Represents an annotation that failed during evaluation
 */
export type AnnotationError = {
  /** The name of the evaluator that produced the error */
  evaluatorName: string;
  /** The error message */
  message: string;
  /** Optional trace for viewing the evaluator's execution */
  trace?: {
    traceId: string;
    projectId: string;
  } | null;
};

// Union type for items in the unified list
type AnnotationListItem =
  | { type: "loaded"; annotation: AnnotationWithTrace }
  | { type: "pending"; name: string }
  | { type: "error"; error: AnnotationError };

/** Helper to get the name/identifier from any annotation list item type */
function getItemName(item: AnnotationListItem): string {
  switch (item.type) {
    case "loaded":
      return item.annotation.name;
    case "pending":
      return item.name;
    case "error":
      return item.error.evaluatorName;
    default:
      return assertUnreachable(item);
  }
}

export type ExperimentRunCellAnnotationsListProps = {
  /** Loaded annotations to display */
  annotations: readonly AnnotationWithTrace[];
  /** Annotation errors to display */
  annotationErrors?: readonly AnnotationError[];
  /** Annotation summaries for displaying averages */
  annotationSummaries?: readonly AnnotationSummary[];
  /** Number of repetitions (for showing averages) */
  numRepetitions?: number;
  /** Callback when trace icon is clicked */
  onTraceClick?: ({
    annotationName,
    traceId,
    projectId,
  }: {
    annotationName: string;
    traceId: string;
    projectId: string;
  }) => void;
  /** Whether to render filter options in the annotation popover */
  renderFilters?: boolean;
  /**
   * Configs for all expected annotations/evaluators.
   * Used for optimization direction coloring and to show skeleton placeholders
   * for evaluators that haven't produced results yet.
   */
  annotationConfigs?: readonly AnnotationConfig[];
  /**
   * Execution state for pending annotations.
   * - idle: Show "--" placeholder text
   * - running: Show skeleton animation
   */
  executionState?: ExecutionState;
  /**
   * Whether to show each annotation's delta against the base experiment.
   * Off on the base column and when the user hides deltas.
   */
  showDeltas?: boolean;
  /**
   * The base run's annotations at the same repetition, for label deltas.
   * Undefined when the base has no run at that repetition.
   */
  baseAnnotations?: readonly AnnotationWithTrace[];
  /**
   * The base run group's annotation summaries, for score deltas on the
   * per-run means.
   */
  baseAnnotationSummaries?: readonly AnnotationSummary[];
};

/**
 * Indexes annotations by name.
 */
function indexAnnotationsByName(
  annotations: readonly AnnotationWithTrace[] | undefined
): Partial<Record<string, AnnotationWithTrace>> {
  return Object.fromEntries(
    (annotations ?? []).map((annotation) => [annotation.name, annotation])
  );
}

/**
 * A loaded annotation's delta against the base: scores compare the groups'
 * per-run means, labels compare the runs at the same repetition, and mixed
 * kinds have no comparison.
 */
function AnnotationDelta({
  annotation,
  meanScore,
  baseAnnotation,
  baseMeanScore,
  config,
  numRepetitions,
}: {
  annotation: AnnotationWithTrace;
  meanScore: number | null | undefined;
  baseAnnotation: AnnotationWithTrace | undefined;
  baseMeanScore: number | null | undefined;
  config: AnnotationConfig | undefined;
  numRepetitions: number;
}) {
  const repetitionNote =
    numRepetitions > 1
      ? `Mean per run across ${numRepetitions} repetitions`
      : undefined;
  if (annotation.score != null) {
    // Both sides compare group means when both exist, otherwise run scores
    const compareMeans = meanScore != null && baseMeanScore != null;
    const compare = compareMeans ? meanScore : annotation.score;
    const base = compareMeans ? baseMeanScore : (baseAnnotation?.score ?? null);
    const { optimizationDirection } = getOptimizationBounds(config);
    return (
      <ExperimentMetricDelta
        delta={computeMetricDelta({ base, compare, optimizationDirection })}
        display="absolute"
        metricLabel={annotation.name}
        formatter={floatFormatter}
        compareValueText={floatFormatter(compare)}
        baseValueText={floatFormatter(base)}
        note={
          base == null
            ? "The base has no score for this annotation"
            : compareMeans
              ? repetitionNote
              : undefined
        }
        size="XS"
      />
    );
  }
  return (
    <ExperimentLabelDelta
      delta={computeLabelDelta({
        baseLabel: baseAnnotation?.label,
        compareLabel: annotation.label,
        config,
      })}
      annotationName={annotation.name}
      note={
        annotation.label == null
          ? "This run has no label for this annotation"
          : baseAnnotation?.label == null
            ? "The base run has no label for this annotation"
            : undefined
      }
      size="XS"
    />
  );
}

export function ExperimentRunCellAnnotationsList(
  props: ExperimentRunCellAnnotationsListProps
) {
  const {
    annotations,
    annotationErrors,
    annotationSummaries,
    onTraceClick,
    numRepetitions = 1,
    renderFilters,
    annotationConfigs,
    executionState = "idle",
    showDeltas = false,
    baseAnnotations,
    baseAnnotationSummaries,
  } = props;
  const baseAnnotationByName = useMemo(
    () => indexAnnotationsByName(baseAnnotations),
    [baseAnnotations]
  );
  const baseSummaryByName = useMemo(
    () => indexSummariesByAnnotationName(baseAnnotationSummaries),
    [baseAnnotationSummaries]
  );
  const annotationSummaryByAnnotationName = useMemo(
    () => indexSummariesByAnnotationName(annotationSummaries),
    [annotationSummaries]
  );

  const annotationConfigsByName = useMemo(() => {
    return (
      annotationConfigs?.reduce(
        (acc, config) => {
          acc[config.name] = config;
          return acc;
        },
        {} as Record<string, AnnotationConfig>
      ) ?? {}
    );
  }, [annotationConfigs]);

  // Create a unified list of loaded annotations, errors, and pending placeholders
  const unifiedItems = useMemo(() => {
    const loadedAnnotationNames = new Set(annotations.map((a) => a.name));
    const errorAnnotationNames = new Set(
      annotationErrors?.map((e) => e.evaluatorName) ?? []
    );

    const items: AnnotationListItem[] = [];

    // Add loaded annotations
    for (const annotation of annotations) {
      items.push({ type: "loaded", annotation });
    }

    // Add error annotations
    if (annotationErrors) {
      for (const error of annotationErrors) {
        items.push({ type: "error", error });
      }
    }

    // Add pending placeholders for evaluators that haven't produced results yet
    if (annotationConfigs) {
      for (const config of annotationConfigs) {
        // Only add pending if not already loaded or errored
        if (
          !loadedAnnotationNames.has(config.name) &&
          !errorAnnotationNames.has(config.name)
        ) {
          items.push({ type: "pending", name: config.name });
        }
      }
    }

    // Sort alphabetically by name
    items.sort((a, b) => {
      const nameA = getItemName(a);
      const nameB = getItemName(b);
      return nameA.localeCompare(nameB);
    });

    return items;
  }, [annotations, annotationErrors, annotationConfigs]);

  // Don't render if there are no items
  if (unifiedItems.length === 0) {
    return null;
  }

  return (
    <ul css={listCSS}>
      {unifiedItems.map((item) => {
        if (item.type === "pending") {
          return (
            <AnnotationPlaceholder
              key={`pending-${item.name}`}
              name={item.name}
              executionState={executionState}
            />
          );
        }

        if (item.type === "error") {
          return (
            <AnnotationErrorItem
              key={`error-${item.error.evaluatorName}`}
              error={item.error}
              onTraceClick={onTraceClick}
            />
          );
        }

        const annotation = item.annotation;
        const traceId = annotation.trace?.traceId;
        const projectId = annotation.trace?.projectId;
        const hasTrace = traceId != null && projectId != null;
        const meanAnnotationScore =
          annotationSummaryByAnnotationName[annotation.name]?.meanScore;
        const annotationConfig: AnnotationConfig | undefined =
          annotationConfigsByName[annotation.name];
        const positiveOptimization = getPositiveOptimizationFromConfig({
          config: annotationConfig,
          score: annotation.score,
        });

        return (
          <li key={annotation.id} css={listItemCSS}>
            <TooltipTrigger delay={0}>
              <ExperimentAnnotationButton
                annotation={annotation}
                positiveOptimization={positiveOptimization ?? undefined}
                extra={
                  meanAnnotationScore != null && numRepetitions > 1 ? (
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <Text fontFamily="mono">
                        {floatFormatter(meanAnnotationScore)}
                      </Text>
                      <Text fontFamily="mono" color="gray-500">
                        AVG
                      </Text>
                    </Flex>
                  ) : null
                }
              />
              <RichTooltip placement="top start">
                <AnnotationDetailsContent annotation={annotation} />
              </RichTooltip>
            </TooltipTrigger>
            {showDeltas && (
              <AnnotationDelta
                annotation={annotation}
                meanScore={meanAnnotationScore}
                baseAnnotation={baseAnnotationByName[annotation.name]}
                baseMeanScore={baseSummaryByName[annotation.name]?.meanScore}
                config={annotationConfig}
                numRepetitions={numRepetitions}
              />
            )}
            {renderFilters && (
              <DialogTrigger>
                <TooltipTrigger>
                  <IconButton size="S" aria-label="Filter by annotation">
                    <Icon svg={<Icons.ListFilter />} />
                  </IconButton>
                  <Tooltip>
                    <TooltipArrow />
                    Filter by annotation
                  </Tooltip>
                </TooltipTrigger>
                <Popover placement="top">
                  <PopoverArrow />
                  <Dialog>
                    <Flex direction="column" gap="size-50">
                      <View paddingX="size-200" paddingTop="size-100">
                        <Heading level={4} weight="heavy">
                          Filters
                        </Heading>
                      </View>
                      <ExperimentRunAnnotationFiltersList
                        annotation={annotation}
                      />
                    </Flex>
                  </Dialog>
                </Popover>
              </DialogTrigger>
            )}
            <TooltipTrigger>
              <IconButton
                size="S"
                onPress={() => {
                  if (hasTrace && onTraceClick) {
                    onTraceClick({
                      annotationName: annotation.name,
                      traceId,
                      projectId,
                    });
                  }
                }}
                isDisabled={!hasTrace}
              >
                <Icon svg={<Icons.Trace />} />
              </IconButton>
              <Tooltip>
                <TooltipArrow />
                View evaluation trace
              </Tooltip>
            </TooltipTrigger>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A placeholder for a single annotation item
 * Displays the annotation name with either a skeleton (running) or placeholder text (idle)
 */
function AnnotationPlaceholder({
  name,
  executionState,
}: {
  name: string;
  executionState: ExecutionState;
}) {
  return (
    <li css={listItemCSS}>
      <div css={placeholderButtonCSS}>
        <Flex direction="row" gap="size-100" alignItems="center">
          <Text weight="heavy" css={nameTextCSS} title={name}>
            {name}
          </Text>
          {executionState === "idle" ? (
            <Text fontFamily="mono" color="text-300">
              --
            </Text>
          ) : (
            <Skeleton width={50} height={24} />
          )}
        </Flex>
      </div>
      {executionState !== "idle" && (
        <IconButton size="S" isDisabled aria-label="View evaluation trace">
          <Icon svg={<Icons.Trace />} />
        </IconButton>
      )}
    </li>
  );
}

/**
 * Displays an annotation that failed during evaluation
 * Shows the evaluator name in red with a tooltip containing the error message
 */
function AnnotationErrorItem({
  error,
  onTraceClick,
}: {
  error: AnnotationError;
  onTraceClick?: ({
    annotationName,
    traceId,
    projectId,
  }: {
    annotationName: string;
    traceId: string;
    projectId: string;
  }) => void;
}) {
  const traceId = error.trace?.traceId;
  const projectId = error.trace?.projectId;
  const hasTrace = traceId != null && projectId != null;

  return (
    <li css={listItemCSS}>
      <TooltipTrigger delay={0}>
        <Pressable>
          <button className="button--reset" css={errorButtonCSS}>
            <Flex direction="row" gap="size-100" alignItems="center">
              <Text weight="heavy" color="danger" css={nameTextCSS}>
                {error.evaluatorName}
              </Text>
              <Icon svg={<Icons.AlertTriangle />} color="danger" />
            </Flex>
          </button>
        </Pressable>
        <RichTooltip placement="top start">
          <TooltipArrow />
          <RichTooltipTitle>
            Error running evaluator &quot;{error.evaluatorName}&quot;
          </RichTooltipTitle>
          <RichTooltipDescription>{error.message}</RichTooltipDescription>
        </RichTooltip>
      </TooltipTrigger>
      <TooltipTrigger>
        <IconButton
          size="S"
          isDisabled={!hasTrace}
          onPress={() => {
            if (hasTrace && onTraceClick) {
              onTraceClick({
                annotationName: error.evaluatorName,
                traceId,
                projectId,
              });
            }
          }}
          aria-label="View evaluation trace"
        >
          <Icon svg={<Icons.Trace />} />
        </IconButton>
        <Tooltip>
          <TooltipArrow />
          View evaluation trace
        </Tooltip>
      </TooltipTrigger>
    </li>
  );
}
