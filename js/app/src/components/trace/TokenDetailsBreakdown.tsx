import { css } from "@emotion/react";

import { Divider, Text, TextSkeleton } from "@phoenix/components";
import type {
  BreakdownDimension,
  BreakdownSegment,
} from "@phoenix/components/chart";
import {
  BreakdownBars,
  BreakdownBarsSkeleton,
  BreakdownTable,
  BreakdownTableSkeleton,
  useCategoryChartColors,
} from "@phoenix/components/chart";
import {
  costPreciseFormatter,
  numberFormatter,
} from "@phoenix/utils/numberFormatUtils";
import { isPositiveNumber } from "@phoenix/utils/numberUtils";
import {
  compareTokenTypes,
  getTokenDetailLabelForKind,
  getTokenDetailSeriesColors,
  getTokenDetailValuesWithRemainder,
  getTokenKind,
  getTokenKindLabel,
} from "@phoenix/utils/tokenDetailUtils";

/**
 * Values keyed by token type, e.g. `{ input: 12, cache_read: 4 }`.
 */
type TokenDetailValues = Record<string, number | null | undefined>;

type TokenDetailEntry = {
  tokenType: string;
  isPrompt: boolean;
};

/**
 * Collects one side's per-token-type values into the map
 * {@link TokenDetailsBreakdown} draws for that side.
 *
 * @param params - Collection context.
 * @param params.entries - Per-token-type entries for both sides.
 * @param params.isPrompt - Whether to collect the prompt or the completion side.
 * @param params.getValue - Reads the value to plot from an entry, e.g. its tokens or its cost.
 * @returns Values keyed by token type, or `undefined` when the side has none.
 */
export function getTokenDetails<Entry extends TokenDetailEntry>({
  entries,
  isPrompt,
  getValue,
}: {
  entries: ReadonlyArray<Entry>;
  isPrompt: boolean;
  getValue: (entry: Entry) => number | null | undefined;
}): Record<string, number> | undefined {
  const values = entries.flatMap((entry) => {
    const value = getValue(entry);
    return entry.isPrompt === isPrompt && value != null
      ? [[entry.tokenType, value] as const]
      : [];
  });
  return values.length > 0 ? Object.fromEntries(values) : undefined;
}

/**
 * One measure of usage, tokens or cost, as a total split into prompt and
 * completion and, where known, further into token types.
 */
export type TokenDetailTotals = {
  total?: number | null;
  prompt?: number | null;
  completion?: number | null;
  /**
   * Prompt values keyed by token type, e.g. `{ input: 12, cache_read: 4 }`.
   */
  promptDetails?: TokenDetailValues | null;
  /**
   * Completion values keyed by token type.
   */
  completionDetails?: TokenDetailValues | null;
};

export interface TokenDetailsBreakdownProps {
  /** Token counts. Omit for usage that was not counted. */
  tokens?: TokenDetailTotals | null;
  /** Costs. Omit when no pricing applied. */
  costs?: TokenDetailTotals | null;
  /**
   * Qualifies the totals in the heading, e.g. "Average" for an experiment's
   * mean per run. Omit for plain totals.
   */
  totalLabel?: string;
}

/**
 * The tooltip width that fits the breakdown with both measures: the table's
 * rows carry a value and a share for each of the two beside the type's name.
 * Pass it to the `RichTooltip` of a host that shows tokens and cost together;
 * a single measure fits the tooltip's default cap.
 */
export const TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH = 380;

/**
 * The characters of the split summary around its two numbers:
 * " prompt → " and " completion".
 */
const SPLIT_SUMMARY_FIXED_CHARS = " prompt → ".length + " completion".length;

const tokenDetailsBreakdownCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
  min-width: 240px;

  .token-details-breakdown__header {
    display: flex;
    /* The split drops under the heading when the two will not share a line */
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--global-dimension-size-50) var(--global-dimension-size-200);
    white-space: nowrap;
  }
  .token-details-breakdown__split {
    margin-left: auto;
  }
`;

type CategoryChartColors = ReturnType<typeof useCategoryChartColors>;

type TokenMeasure = {
  key: "tokens" | "cost";
  label: string;
  formatter: (value: number) => string;
  data: TokenDetailTotals;
};

/**
 * Whether a measure has anything to show: a total or a part above zero.
 */
function hasUsage(
  data: TokenDetailTotals | null | undefined
): data is TokenDetailTotals {
  if (!data) {
    return false;
  }
  return (
    isPositiveNumber(data.total) ||
    isPositiveNumber(data.prompt) ||
    isPositiveNumber(data.completion) ||
    Object.values(data.promptDetails ?? {}).some(isPositiveNumber) ||
    Object.values(data.completionDetails ?? {}).some(isPositiveNumber)
  );
}

function getMeasures({
  tokens,
  costs,
}: Pick<TokenDetailsBreakdownProps, "tokens" | "costs">): TokenMeasure[] {
  const measures: TokenMeasure[] = [];
  if (hasUsage(tokens)) {
    measures.push({
      key: "tokens",
      label: "Tokens",
      formatter: numberFormatter,
      data: tokens,
    });
  }
  if (hasUsage(costs)) {
    measures.push({
      key: "cost",
      label: "Cost",
      formatter: costPreciseFormatter,
      data: costs,
    });
  }
  return measures;
}

/**
 * Keys a token type by the side it was used on, since audio, say, can be
 * both heard in the prompt and spoken in the completion.
 */
function getSegmentKey({
  isPrompt,
  tokenType,
}: {
  isPrompt: boolean;
  tokenType: string;
}) {
  return `${getTokenKind({ isPrompt })}:${tokenType}`;
}

/**
 * Lays tokens and costs out over one set of token-type segments, so that a
 * token type has the same row, color and position in the tokens bar as in
 * the cost bar.
 *
 * Prompt token types come first, then completion types, each side in the
 * canonical token-type order. Any value a side's details do not account for
 * is attributed to that side's plain type, input or output, so every bar adds
 * up to the total it is drawn against; a side with no details at all is one
 * plain segment. A type a measure reported as exactly zero, where another
 * measure has usage for it, is kept as a measured zero rather than dropped as
 * unmeasured. Each dimension marks where its prompt ends and its completion
 * begins.
 *
 * @param params - The usage to lay out.
 * @param params.tokens - Token counts, if counted.
 * @param params.costs - Costs, if priced.
 * @param params.colors - Theme-aware categorical chart colors.
 * @returns The measures with usage, and their segments and dimensions; all
 *   empty when there is no usage.
 */
export function buildTokenBreakdown({
  tokens,
  costs,
  colors,
}: Pick<TokenDetailsBreakdownProps, "tokens" | "costs"> & {
  colors: CategoryChartColors;
}): {
  measures: TokenMeasure[];
  segments: BreakdownSegment[];
  dimensions: BreakdownDimension[];
} {
  const measures = getMeasures({ tokens, costs });
  const valuesByMeasure: Record<
    string,
    Record<string, number>
  > = Object.fromEntries(measures.map((measure) => [measure.key, {}]));

  /**
   * Records one side's values for every measure and returns the token types
   * the side used, in display order.
   */
  const layOutSide = (isPrompt: boolean): string[] => {
    const tokenTypes = new Set<string>();
    const sides = measures.map((measure) => {
      const details = isPrompt
        ? measure.data.promptDetails
        : measure.data.completionDetails;
      const values = getTokenDetailValuesWithRemainder({
        details,
        sideTotal: isPrompt ? measure.data.prompt : measure.data.completion,
        isPrompt,
      });
      Object.entries(values).forEach(([tokenType, value]) => {
        valuesByMeasure[measure.key][getSegmentKey({ isPrompt, tokenType })] =
          value;
        tokenTypes.add(tokenType);
      });
      return { measure, details };
    });
    // A type another measure has usage for, that this one reported as
    // exactly zero, was measured as zero, not left unmeasured: cache reads
    // that were counted but cost nothing
    sides.forEach(({ measure, details }) => {
      tokenTypes.forEach((tokenType) => {
        const key = getSegmentKey({ isPrompt, tokenType });
        if (
          valuesByMeasure[measure.key][key] == null &&
          details?.[tokenType] === 0
        ) {
          valuesByMeasure[measure.key][key] = 0;
        }
      });
    });
    return [...tokenTypes].sort(compareTokenTypes);
  };
  const promptTypes = layOutSide(true);
  const completionTypes = layOutSide(false);

  const sides = [
    ...promptTypes.map((tokenType) => ({ isPrompt: true, tokenType })),
    ...completionTypes.map((tokenType) => ({ isPrompt: false, tokenType })),
  ].map((side) => ({ ...side, key: getSegmentKey(side) }));
  // A type used on both sides is two segments, so the second gives up the
  // type's color, as it does in the metrics charts
  const colorByKey = getTokenDetailSeriesColors({ colors, series: sides });
  const segments: BreakdownSegment[] = sides.map(
    ({ key, isPrompt, tokenType }) => ({
      key,
      label: getTokenDetailLabelForKind({
        tokenType,
        isPrompt,
        isUsedByBothKinds:
          promptTypes.includes(tokenType) &&
          completionTypes.includes(tokenType),
      }),
      color: colorByKey.get(key) ?? "",
    })
  );

  const dimensions: BreakdownDimension[] = measures.map((measure) => {
    const values = valuesByMeasure[measure.key];
    const sum = Object.values(values).reduce((acc, value) => acc + value, 0);
    const { prompt, completion } = measure.data;
    return {
      key: measure.key,
      label: measure.label,
      total: measure.data.total ?? sum,
      values,
      formatter: measure.formatter,
      markerValues:
        prompt != null && completion != null && prompt > 0 && completion > 0
          ? [prompt]
          : undefined,
    };
  });

  return { measures, segments, dimensions };
}

/**
 * The heading over the breakdown: which measures it holds, qualified when
 * the totals are not plain totals. "Tokens and cost", "Average cost".
 */
function getHeading(measures: TokenMeasure[], totalLabel?: string) {
  const labels = measures.map((measure) => measure.label);
  if (totalLabel) {
    // "Average tokens and cost": the qualifier keeps its case, the rest lower
    return `${totalLabel} ${labels.map((label) => label.toLowerCase()).join(" and ")}`;
  }
  // "Tokens and cost": the first label keeps its case, the rest lower
  const [first, ...rest] = labels;
  return [first, ...rest.map((label) => label.toLowerCase())].join(" and ");
}

/**
 * The prompt and completion totals of the first measure that has both, as
 * "48,210 prompt → 1,284 completion", so the split the bar marker points at
 * is also given in numbers, in the words the rest of Phoenix uses for it.
 */
function getSplitSummary(measures: TokenMeasure[]): string | null {
  for (const { formatter, data } of measures) {
    const { prompt, completion } = data;
    if (prompt != null && completion != null) {
      const side = (isPrompt: boolean) =>
        getTokenKindLabel({ isPrompt }).toLowerCase();
      return `${formatter(prompt)} ${side(true)} → ${formatter(completion)} ${side(false)}`;
    }
  }
  return null;
}

/**
 * Token usage and what it cost, broken down by token type.
 *
 * A bar per measure, tokens and cost, splits the total into the token types
 * that make it up, with a tick where the prompt ends and the completion
 * begins; the bars share their segments so a type's share of the tokens can
 * be read against its share of the cost. Under them a table gives each
 * type's value and share in every measure. Pass one measure or both: the
 * layout is the same, and a measure whose split is not yet known draws as
 * one bar of its total, so a tooltip can open on totals it already has and
 * fill in the split when it loads.
 *
 * Renders nothing when there is no usage to show, so callers pass what they
 * have without checking first.
 */
export function TokenDetailsBreakdown({
  tokens,
  costs,
  totalLabel,
}: TokenDetailsBreakdownProps) {
  const colors = useCategoryChartColors();
  const { measures, segments, dimensions } = buildTokenBreakdown({
    tokens,
    costs,
    colors,
  });
  if (measures.length === 0) {
    return null;
  }
  const splitSummary = getSplitSummary(measures);
  return (
    <div className="token-details-breakdown" css={tokenDetailsBreakdownCSS}>
      <header className="token-details-breakdown__header">
        <Text size="S" weight="heavy">
          {getHeading(measures, totalLabel)}
        </Text>
        {splitSummary ? (
          <Text
            className="token-details-breakdown__split"
            size="XS"
            fontFamily="mono"
            color="text-500"
          >
            {splitSummary}
          </Text>
        ) : null}
      </header>
      <BreakdownBars segments={segments} dimensions={dimensions} />
      {segments.length > 0 ? (
        <>
          <Divider />
          <BreakdownTable segments={segments} dimensions={dimensions} />
        </>
      ) : null}
    </div>
  );
}

export interface TokenDetailsBreakdownSkeletonProps extends TokenDetailsBreakdownProps {
  /**
   * How many token-type rows to leave room for in the table. The default
   * suits a modern LLM call, which breaks down into input, cache read and
   * output.
   * @default 3
   */
  rows?: number;
}

/**
 * The split summary's width in its own characters: the words around two
 * numbers, of which the prompt is about as long as the total and the
 * completion a good deal shorter.
 */
function getSplitSkeletonWidth(total: string | undefined) {
  const totalChars = total?.length ?? 6;
  return `${Math.ceil(totalChars * 1.5) + SPLIT_SUMMARY_FIXED_CHARS}ch`;
}

/**
 * The breakdown's shape while its split loads, for the `Suspense` fallback
 * of a tooltip that opens on totals it already has.
 *
 * The heading and each measure's label and total are drawn from what the
 * caller passes, since they are known before the fetch; the split summary,
 * the bars and the table rows are drawn as skeletons in their places, on the
 * same grid as the loaded breakdown. The header, bars and table columns then
 * hold still when the details land; the table's rows are a guess at how
 * many token types the usage has, and are all that can change.
 *
 * Pass the totals the loaded breakdown will get, and it renders nothing when
 * they hold no usage, just as the breakdown itself would.
 */
export function TokenDetailsBreakdownSkeleton({
  tokens,
  costs,
  totalLabel,
  rows,
}: TokenDetailsBreakdownSkeletonProps) {
  const measures = getMeasures({ tokens, costs });
  if (measures.length === 0) {
    return null;
  }
  const dimensions = measures.map(({ key, label, formatter, data }) => ({
    key,
    label,
    total: data.total != null ? formatter(data.total) : undefined,
  }));
  return (
    <div
      className="token-details-breakdown"
      css={tokenDetailsBreakdownCSS}
      aria-busy="true"
    >
      <header className="token-details-breakdown__header">
        <Text size="S" weight="heavy">
          {getHeading(measures, totalLabel)}
        </Text>
        <TextSkeleton
          className="token-details-breakdown__split"
          size="XS"
          fontFamily="mono"
          width={getSplitSkeletonWidth(dimensions[0].total)}
        />
      </header>
      <BreakdownBarsSkeleton dimensions={dimensions} />
      <Divider />
      <BreakdownTableSkeleton dimensions={dimensions} rows={rows} />
    </div>
  );
}
