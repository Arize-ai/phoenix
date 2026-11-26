import { css } from "@emotion/react";
import { Focusable } from "react-aria";

import {
  Dialog,
  DialogTrigger,
  Icon,
  IconButton,
  Icons,
  Popover,
  PopoverArrow,
  ProgressBar,
  Text,
  Tooltip,
  TooltipTrigger,
  truncateSingleCSS,
  View,
} from "@phoenix/components";
import type {
  Annotation,
  AnnotationConfig,
} from "@phoenix/components/annotation";
import {
  AnnotationColorSwatch,
  getAnnotationScoreColorProps,
  getOptimizationBounds,
  getOptimizationValueFromConfig,
} from "@phoenix/components/annotation";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
import { ExperimentAnnotationButton } from "@phoenix/components/experiment/ExperimentAnnotationButton";
import { MISSING_VALUE_TEXT } from "@phoenix/components/experiment/experimentDeltaUtils";
import {
  ExperimentLabelDelta,
  ExperimentMetricDelta,
} from "@phoenix/components/experiment/ExperimentMetricDelta";
import { useWordColor } from "@phoenix/hooks";
import { assertUnreachable } from "@phoenix/typeUtils";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import type {
  AnnotationRepetitionCell,
  AnnotationRowDelta,
  AnnotationRowKind,
  LaneAnnotationRow,
} from "./experimentCompareAnnotationRows";
import { capRepetitionCells } from "./experimentCompareAnnotationRows";
import type { CompareLaneAnnotation } from "./useExperimentCompareLaneRunGroup";

export type ExperimentCompareAnnotationsTableRow = {
  row: LaneAnnotationRow<CompareLaneAnnotation>;
  /** The annotation's config, for its optimization direction */
  config: AnnotationConfig | undefined;
  /** The change against the base lane; null when the lane shows none */
  delta: AnnotationRowDelta | null;
  /** The base lane's value as its own row shows it, for the delta tooltip */
  baseValueText?: string;
};

type AnnotationTraceSelection = {
  traceId: string;
  projectId: string;
  annotationName: string;
};

const annotationsTableCSS = css`
  display: grid;
  column-gap: var(--global-dimension-size-100);
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  overflow: hidden;
  font-size: var(--global-font-size-s);

  .experiment-compare-annotations__row {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
    align-items: center;
    min-height: var(--global-dimension-size-400);
    /* Matches the inset of the cards the table sits beside */
    padding: 0 var(--global-dimension-size-100) 0
      var(--global-dimension-size-200);
    &:not(:last-of-type) {
      border-bottom: var(--global-border-size-thin) solid
        var(--global-color-gray-100);
    }
  }

  .experiment-compare-annotations__row--header {
    min-height: var(--global-card-header-height);
    background-color: var(--global-color-gray-75);
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-xs);
    border-bottom: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  .experiment-compare-annotations__name {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    min-width: 0;
  }

  .experiment-compare-annotations__missing {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    color: var(--global-text-color-500);
  }

  .experiment-compare-annotations__missing-name {
    ${truncateSingleCSS}
  }

  .experiment-compare-annotations__average {
    font-family: var(--global-font-family-mono);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-700);
    text-align: right;
    max-width: 12ch;
    ${truncateSingleCSS}
  }

  .experiment-compare-annotations__numeric-header {
    text-align: right;
  }

  .experiment-compare-annotations__trailing {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--global-dimension-size-50);
  }
`;

const NAME_AND_BAR_COLUMNS = "minmax(0, 1fr) minmax(32px, 72px)";
const REPETITION_COLUMNS = "minmax(0, max-content) minmax(0, max-content)";
const DELTA_AND_TRACE_COLUMN = "minmax(0, max-content)";

const repetitionCellsCSS = css`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: var(--global-dimension-size-25);
  border-radius: var(--global-rounding-xsmall);
  cursor: default;

  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
  }

  .experiment-compare-repetition-cells__cell {
    position: relative;
    box-sizing: border-box;
    width: var(--global-dimension-size-100);
    height: var(--global-dimension-size-100);
    border: var(--global-border-size-thin) solid var(--repetition-cell-color);
    border-radius: var(--global-rounding-xsmall);
    overflow: hidden;
    &[data-kind="label"] {
      border-radius: var(--global-rounding-full);
    }
    &[data-empty="true"] {
      border-style: dashed;
      border-color: var(--global-text-color-300);
    }
    &[data-shown="true"] {
      outline: var(--global-border-size-thin) solid var(--global-text-color-900);
      outline-offset: 1px;
    }
  }

  .experiment-compare-repetition-cells__fill {
    position: absolute;
    inset: 0;
    background-color: var(--repetition-cell-color);
  }

  .experiment-compare-repetition-cells__more {
    font-family: var(--global-font-family-mono);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }
`;

const tooltipLineCSS = css`
  display: block;
`;

function getRepetitionCellFillOpacity({
  cell,
  kind,
}: {
  cell: AnnotationRepetitionCell;
  kind: AnnotationRowKind;
}): number {
  switch (kind) {
    case "score":
      return cell.fillOpacity;
    case "label":
      return cell.isMatchingShownLabel ? 1 : 0;
    case "empty":
      return 0;
    default:
      return assertUnreachable(kind);
  }
}

/**
 * One cell per repetition of an annotation. Score cells are squares that
 * fill darker with the score. Label cells are circles, filled when the
 * repetition has the label the lane is showing. The repetition shown is
 * outlined, cells past the cap collapse to `+N`, and the tooltip lists every
 * repetition's value.
 */
function ExperimentCompareRepetitionCells({
  annotationName,
  cells,
  kind,
}: {
  annotationName: string;
  cells: readonly AnnotationRepetitionCell[];
  kind: AnnotationRowKind;
}) {
  const color = useWordColor(annotationName);
  const { visibleCells, hiddenCount } = capRepetitionCells({ cells });
  if (cells.length === 0) {
    return null;
  }
  return (
    <TooltipTrigger delay={200}>
      <Focusable>
        <span
          role="img"
          tabIndex={0}
          aria-label={`${annotationName} across ${cells.length} repetitions`}
          className="experiment-compare-repetition-cells"
          css={repetitionCellsCSS}
          style={{ "--repetition-cell-color": color } as React.CSSProperties}
        >
          {visibleCells.map((cell) => (
            <span
              key={cell.repetitionNumber}
              className="experiment-compare-repetition-cells__cell"
              data-kind={kind}
              data-shown={cell.isShown}
              data-empty={!cell.hasValue}
            >
              <span
                className="experiment-compare-repetition-cells__fill"
                style={{
                  opacity: getRepetitionCellFillOpacity({ cell, kind }),
                }}
              />
            </span>
          ))}
          {hiddenCount > 0 ? (
            <span className="experiment-compare-repetition-cells__more">
              +{hiddenCount}
            </span>
          ) : null}
        </span>
      </Focusable>
      <Tooltip placement="end">
        {cells.map((cell) => (
          <Text
            key={cell.repetitionNumber}
            size="XS"
            css={tooltipLineCSS}
            weight={cell.isShown ? "heavy" : "normal"}
          >
            repetition {cell.repetitionNumber}: {cell.valueText}
          </Text>
        ))}
      </Tooltip>
    </TooltipTrigger>
  );
}

function AnnotationScoreBar({
  annotationName,
  score,
  scorePercent,
  config,
}: {
  annotationName: string;
  score: number;
  scorePercent: number;
  config: AnnotationConfig | undefined;
}) {
  const annotationColor = useWordColor(annotationName);
  const { "data-direction": direction, css: scoreColorCSS } =
    getAnnotationScoreColorProps(
      getOptimizationValueFromConfig({ config, score })
    );
  return (
    <ProgressBar
      data-direction={direction}
      css={css(
        scoreColorCSS,
        css`
          --mod-barloader-fill-color: var(
            --annotation-score-color,
            ${annotationColor}
          );
        `
      )}
      value={scorePercent}
      height="var(--global-dimension-size-50)"
      width="100%"
      aria-label={`${annotationName} score`}
    />
  );
}

function AnnotationRowDeltaToken({
  annotationName,
  delta,
  config,
  compareValueText,
  baseValueText,
}: {
  annotationName: string;
  delta: AnnotationRowDelta;
  config: AnnotationConfig | undefined;
  compareValueText: string;
  baseValueText: string | undefined;
}) {
  if (delta.type === "label") {
    return (
      <ExperimentLabelDelta
        delta={delta.delta}
        annotationName={annotationName}
        size="XS"
      />
    );
  }
  const hasBothValues = delta.delta.kind !== "undefined";
  return (
    <ExperimentMetricDelta
      delta={delta.delta}
      display="absolute"
      metricLabel={annotationName}
      formatter={floatFormatter}
      compareValueText={hasBothValues ? compareValueText : undefined}
      baseValueText={hasBothValues ? baseValueText : undefined}
      note={
        getOptimizationBounds(config).optimizationDirection == null
          ? "No optimization direction set"
          : undefined
      }
      size="XS"
      variant="tabular"
    />
  );
}

/**
 * A lane's annotations for the repetition it shows: name and value, a score
 * bar, a cell per repetition with their average, the change against the base
 * lane, and a button for the evaluator's trace. Rows for annotations the
 * lane does not have still render, so both lanes list the same rows.
 */
export function ExperimentCompareAnnotationsTable({
  rows,
  hasRepetitions,
  showsDeltas,
  onOpenAnnotationTrace,
}: {
  rows: readonly ExperimentCompareAnnotationsTableRow[];
  /** Whether the lane's experiment repeats, which adds the repetition columns */
  hasRepetitions: boolean;
  /** Whether the lane compares against a base lane */
  showsDeltas: boolean;
  onOpenAnnotationTrace: (selection: AnnotationTraceSelection) => void;
}) {
  const gridTemplateColumns = [
    NAME_AND_BAR_COLUMNS,
    ...(hasRepetitions ? [REPETITION_COLUMNS] : []),
    DELTA_AND_TRACE_COLUMN,
  ].join(" ");
  return (
    <ul
      className="experiment-compare-annotations"
      css={annotationsTableCSS}
      style={{ gridTemplateColumns }}
    >
      <li
        className="experiment-compare-annotations__row experiment-compare-annotations__row--header"
        aria-hidden="true"
      >
        <Text weight="heavy" size="M">
          Annotations
        </Text>
        <span />
        {hasRepetitions ? (
          <>
            <span>reps</span>
            <span className="experiment-compare-annotations__numeric-header">
              avg
            </span>
          </>
        ) : null}
        <span className="experiment-compare-annotations__numeric-header">
          {showsDeltas ? "vs base" : null}
        </span>
      </li>
      {rows.map(({ row, config, delta, baseValueText }) => {
        const { annotation, annotationName } = row;
        const trace = annotation?.trace;
        return (
          <li
            key={annotationName}
            className="experiment-compare-annotations__row"
          >
            <div className="experiment-compare-annotations__name">
              <AnnotationColorSwatch annotationName={annotationName} />
              {annotation != null ? (
                <DialogTrigger>
                  <ExperimentAnnotationButton
                    annotation={annotation as Annotation}
                    optimizationValue={getOptimizationValueFromConfig({
                      config,
                      score: annotation.score,
                    })}
                    isValueEndAligned
                  />
                  <Popover placement="top">
                    <PopoverArrow />
                    <Dialog style={{ width: 400 }}>
                      <View padding="size-200">
                        <AnnotationDetailsContent
                          annotation={annotation as Annotation}
                        />
                      </View>
                    </Dialog>
                  </Popover>
                </DialogTrigger>
              ) : (
                <div className="experiment-compare-annotations__missing">
                  <span
                    className="experiment-compare-annotations__missing-name"
                    title={annotationName}
                  >
                    {annotationName}
                  </span>
                  <span>{MISSING_VALUE_TEXT}</span>
                </div>
              )}
            </div>
            {annotation?.score != null && row.scorePercent != null ? (
              <AnnotationScoreBar
                annotationName={annotationName}
                score={annotation.score}
                scorePercent={row.scorePercent}
                config={config}
              />
            ) : (
              <span />
            )}
            {hasRepetitions ? (
              <>
                <ExperimentCompareRepetitionCells
                  annotationName={annotationName}
                  cells={row.repetitionCells}
                  kind={row.kind}
                />
                <span
                  className="experiment-compare-annotations__average"
                  title={row.averageText}
                >
                  {row.averageText}
                </span>
              </>
            ) : null}
            <div className="experiment-compare-annotations__trailing">
              {delta != null ? (
                <AnnotationRowDeltaToken
                  annotationName={annotationName}
                  delta={delta}
                  config={config}
                  compareValueText={row.valueText}
                  baseValueText={baseValueText}
                />
              ) : null}
              <TooltipTrigger>
                <IconButton
                  size="S"
                  isDisabled={trace == null}
                  aria-label={`View evaluation trace for ${annotationName}`}
                  onPress={() => {
                    if (trace != null) {
                      onOpenAnnotationTrace({
                        traceId: trace.traceId,
                        projectId: trace.projectId,
                        annotationName,
                      });
                    }
                  }}
                >
                  <Icon svg={<Icons.Trace />} />
                </IconButton>
                <Tooltip placement="end">View evaluation trace</Tooltip>
              </TooltipTrigger>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
