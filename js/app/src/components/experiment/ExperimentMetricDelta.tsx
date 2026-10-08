import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Pressable } from "react-aria";

import {
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation";
import { getOptimizationBounds } from "@phoenix/components/annotation";
import { dotSeparatedRowCSS } from "@phoenix/components/core/styles";
import { classNames } from "@phoenix/utils/classNames";
import {
  floatFormatter,
  numberFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type {
  DeltaDisplay,
  ExperimentRunMetric,
  ExperimentRunMetricsSource,
  LabelDelta,
  MetricDelta,
} from "./experimentDeltaUtils";
import {
  computeMetricDelta,
  computeOperationalMetricDelta,
  describeLabelDelta,
  describeMetricDelta,
  EXPERIMENT_RUN_METRICS,
  formatLabelDelta,
  formatMetricDelta,
  formatSignedMetricDelta,
  getDeltaState,
  getExperimentRunMetricValue,
} from "./experimentDeltaUtils";

export type DeltaSize = "S" | "XS";

export type DeltaTooltipPlacement = "end" | "top";

const metricStatRowCSS = css`
  ${dotSeparatedRowCSS}
  white-space: nowrap;
`;

const metricStatCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
`;

/**
 * A row of metric stats separated by dots: latency · tokens · cost. Each child
 * is one `ExperimentMetricStat`.
 */
export function ExperimentMetricStatRow({ children }: { children: ReactNode }) {
  return (
    <div className="metric-stat-row" css={metricStatRowCSS}>
      {children}
    </div>
  );
}

/**
 * One metric value kept together with its delta, inside an
 * `ExperimentMetricStatRow` or on its own in a table cell.
 */
export function ExperimentMetricStat({ children }: { children: ReactNode }) {
  return (
    <span className="metric-stat-row__stat" css={metricStatCSS}>
      {children}
    </span>
  );
}

const metricDeltaCSS = css`
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-family: var(--global-font-family-mono);
  font-weight: normal;
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  border-radius: var(--global-rounding-xsmall);
  cursor: default;

  &[data-size="XS"] {
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
  }

  &.metric-delta--improved {
    color: var(--global-color-optimization-direction-positive);
  }
  &.metric-delta--regressed {
    color: var(--global-color-optimization-direction-negative);
  }
  &.metric-delta--neutral {
    color: var(--global-text-color-700);
  }
  &.metric-delta--unchanged,
  &.metric-delta--undefined {
    color: var(--global-text-color-500);
  }

  &[data-focus-visible] {
    outline: var(--global-border-size-thick) solid var(--global-color-gray-900);
    outline-offset: 2px;
  }

  .metric-delta__glyph {
    display: inline-flex;
    font-size: 1em;
  }

  &.metric-delta--label {
    min-width: 0;
    max-width: 20ch;
    .metric-delta__value {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

const tooltipLineCSS = css`
  display: block;
`;

/**
 * The inline token shared by every delta: colored by state, focusable so the
 * tooltip opens from the keyboard, and described for assistive technology by
 * the same sentence the tooltip leads with.
 */
function DeltaToken({
  state,
  glyph,
  valueText,
  description,
  tooltipLines,
  size,
  tooltipPlacement,
  isLabel = false,
}: {
  state: ReturnType<typeof getDeltaState>;
  glyph?: ReactNode;
  valueText: string;
  description: string;
  tooltipLines: readonly string[];
  size: DeltaSize;
  tooltipPlacement: DeltaTooltipPlacement;
  /** Truncates the value, since a label can be arbitrarily long */
  isLabel?: boolean;
}) {
  return (
    <TooltipTrigger delay={200}>
      <Pressable>
        <span
          role="button"
          tabIndex={0}
          aria-label={description}
          className={classNames("metric-delta", `metric-delta--${state}`, {
            "metric-delta--label": isLabel,
          })}
          data-size={size}
          css={metricDeltaCSS}
        >
          {glyph ? (
            <span className="metric-delta__glyph" aria-hidden="true">
              {glyph}
            </span>
          ) : null}
          <span className="metric-delta__value" aria-hidden="true">
            {valueText}
          </span>
        </span>
      </Pressable>
      <Tooltip placement={tooltipPlacement}>
        <Text size="XS" css={tooltipLineCSS}>
          {description}
        </Text>
        {tooltipLines.map((line) => (
          <Text key={line} size="XS" color="text-700" css={tooltipLineCSS}>
            {line}
          </Text>
        ))}
      </Tooltip>
    </TooltipTrigger>
  );
}

/**
 * A compare experiment's change in a numeric metric against the base: a
 * arrow for the sign and a magnitude, colored by whether the move was good.
 * Shows `no change` for equal values and `--` when there is nothing to
 * compare.
 */
export function ExperimentMetricDelta({
  delta,
  display,
  metricLabel,
  formatter = numberFormatter,
  compareValueText,
  baseValueText,
  note,
  size = "S",
  tooltipPlacement = "end",
}: {
  delta: MetricDelta;
  /** Which form a change shows; a 0 base falls back to absolute */
  display: DeltaDisplay;
  /** What the number is, for the tooltip and aria-label: `Latency`, `Total tokens`, `reward` */
  metricLabel: string;
  /** Formats absolute magnitudes in the token and the tooltip */
  formatter?: (value: number) => string;
  /** The compare value as the cell shows it, for the tooltip */
  compareValueText?: string;
  /** The base value as the base cell shows it, for the tooltip */
  baseValueText?: string;
  /** An extra tooltip line, such as `Mean per run across 3 repetitions` */
  note?: string;
  size?: DeltaSize;
  tooltipPlacement?: DeltaTooltipPlacement;
}) {
  const description = describeMetricDelta({
    metricLabel,
    delta,
    display,
    formatter,
  });
  const tooltipLines: string[] = [];
  if (compareValueText != null && baseValueText != null) {
    tooltipLines.push(`${compareValueText} vs ${baseValueText} base`);
  }
  if (delta.kind === "changed") {
    tooltipLines.push(formatSignedMetricDelta({ delta, formatter }));
    if (display === "relative" && delta.relative == null) {
      tooltipLines.push("Base is 0, showing the absolute change");
    }
  }
  if (note != null) {
    tooltipLines.push(note);
  }
  const glyph =
    delta.kind === "changed" ? (
      <Icon
        svg={delta.sign === "up" ? <Icons.ArrowUp /> : <Icons.ArrowDown />}
      />
    ) : undefined;
  return (
    <DeltaToken
      state={getDeltaState(delta)}
      glyph={glyph}
      valueText={formatMetricDelta({ delta, display, formatter })}
      description={description}
      tooltipLines={tooltipLines}
      size={size}
      tooltipPlacement={tooltipPlacement}
    />
  );
}

/**
 * An experiment's change in the mean score of an annotation against the base
 * experiment: the absolute change, colored by the annotation config's
 * optimization direction. Without a direction the change is neutral and the
 * tooltip says so.
 */
export function ExperimentAnnotationMeanDelta({
  annotationName,
  meanScore,
  baseMeanScore,
  config,
  size = "S",
  tooltipPlacement = "end",
}: {
  annotationName: string;
  /** The experiment's mean score */
  meanScore: number;
  /** The base experiment's mean score; `null` when the base has none */
  baseMeanScore: number | null;
  /** The annotation's config, for its optimization direction */
  config: AnnotationOptimizationConfig | undefined;
  size?: DeltaSize;
  tooltipPlacement?: DeltaTooltipPlacement;
}) {
  const { optimizationDirection } = getOptimizationBounds(config);
  return (
    <ExperimentMetricDelta
      delta={computeMetricDelta({
        base: baseMeanScore,
        compare: meanScore,
        optimizationDirection,
      })}
      display="absolute"
      metricLabel={`${annotationName} average`}
      formatter={floatFormatter}
      compareValueText={floatFormatter(meanScore)}
      baseValueText={floatFormatter(baseMeanScore)}
      note={
        optimizationDirection == null
          ? "No optimization direction set"
          : undefined
      }
      size={size}
      tooltipPlacement={tooltipPlacement}
    />
  );
}

/**
 * An experiment's change in a per-run metric (latency, tokens, cost or error
 * rate) against the base experiment. Totals are compared per run so
 * experiments with different run counts line up, lower is better, and changes
 * inside the neutral band are neutral. Renders nothing without a base.
 */
export function ExperimentRunMetricDelta({
  metric,
  experiment,
  baseExperiment,
  note,
  size = "S",
  tooltipPlacement = "end",
}: {
  metric: ExperimentRunMetric;
  /** The experiment whose change is shown */
  experiment: ExperimentRunMetricsSource;
  /** The experiment the change is measured against; absent shows no delta */
  baseExperiment: ExperimentRunMetricsSource | null | undefined;
  /** An extra tooltip line, such as how the per-run value was derived */
  note?: string;
  size?: DeltaSize;
  tooltipPlacement?: DeltaTooltipPlacement;
}) {
  if (baseExperiment == null) {
    return null;
  }
  const { label, formatter, display } = EXPERIMENT_RUN_METRICS[metric];
  const compare = getExperimentRunMetricValue({ experiment, metric });
  const base = getExperimentRunMetricValue({
    experiment: baseExperiment,
    metric,
  });
  const hasBothValues = compare != null && base != null;
  return (
    <ExperimentMetricDelta
      delta={computeOperationalMetricDelta({ base, compare })}
      display={display}
      metricLabel={label}
      formatter={formatter}
      compareValueText={hasBothValues ? formatter(compare) : undefined}
      baseValueText={hasBothValues ? formatter(base) : undefined}
      note={note}
      size={size}
      tooltipPlacement={tooltipPlacement}
    />
  );
}

/**
 * A compare run's change in a categorical label against the base run: `was
 * <base label>` colored by the labels' scores when the config has them,
 * `no change` for the same label, and `--` when there is nothing to compare.
 */
export function ExperimentLabelDelta({
  delta,
  annotationName,
  note,
  size = "S",
  tooltipPlacement = "end",
}: {
  delta: LabelDelta;
  annotationName: string;
  /** An extra tooltip line, such as why no comparison is available */
  note?: string;
  size?: DeltaSize;
  tooltipPlacement?: DeltaTooltipPlacement;
}) {
  const tooltipLines: string[] = [];
  if (delta.kind === "changed" && delta.direction !== "neutral") {
    tooltipLines.push(
      `${delta.direction === "improved" ? "Improved" : "Regressed"} per the label scores`
    );
  }
  if (note != null) {
    tooltipLines.push(note);
  }
  return (
    <DeltaToken
      state={getDeltaState(delta)}
      valueText={formatLabelDelta(delta)}
      description={describeLabelDelta({ annotationName, delta })}
      tooltipLines={tooltipLines}
      size={size}
      tooltipPlacement={tooltipPlacement}
      isLabel
    />
  );
}
