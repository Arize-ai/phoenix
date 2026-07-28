import { css } from "@emotion/react";

import { Flex } from "@phoenix/components";
import { useCategoryChartColors } from "@phoenix/components/chart";
import { RichTokenBreakdown } from "@phoenix/components/RichTokenBreakdown";
import {
  compareTokenTypes,
  getTokenDetailColor,
  getTokenDetailLabel,
} from "@phoenix/utils/tokenDetailUtils";

/**
 * Costs and token counts are summed from floating point values, so a detail
 * breakdown that fully accounts for its group can still leave a sliver behind.
 */
const REMAINDER_EPSILON = 1e-9;

const tokenDetailsBreakdownCSS = css`
  min-width: var(--global-dimension-size-3000);
`;

type TokenDetailValues = Record<string, number | null | undefined>;

type DetailSegment = {
  name: string;
  value: number;
  color: string;
};

export interface TokenDetailsBreakdownProps {
  /**
   * The noun for the value being broken down, e.g. "cost" or "tokens".
   */
  valueLabel: string;
  /**
   * Qualifies the total, e.g. "Total" or "Average".
   * @default "Total"
   */
  totalLabel?: string;
  /**
   * Renders a value in the unit being broken down.
   */
  formatter: (value: number) => string;
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
}

/**
 * A total split into prompt and completion, each drawn as a proportional bar
 * with a color-keyed legend. Prompt and completion get a bar of their own when
 * they break down further by token type, e.g. into cache reads and writes.
 */
export function TokenDetailsBreakdown({
  valueLabel,
  totalLabel = "Total",
  formatter,
  total,
  prompt,
  completion,
  promptDetails,
  completionDetails,
}: TokenDetailsBreakdownProps) {
  const colors = useCategoryChartColors();

  if (total == null && prompt == null && completion == null) {
    return null;
  }

  const promptValue = prompt ?? 0;
  const completionValue = completion ?? 0;
  const totalValue = total ?? promptValue + completionValue;
  const segments = [
    ...(prompt != null
      ? [{ name: "Prompt", value: promptValue, color: colors.category1 }]
      : []),
    ...(completion != null
      ? [
          {
            name: "Completion",
            value: completionValue,
            color: colors.category2,
          },
        ]
      : []),
  ];
  const promptSegments = buildDetailSegments({
    colors,
    details: promptDetails,
    groupTotal: promptValue,
    remainderTokenType: "input",
  });
  const completionSegments = buildDetailSegments({
    colors,
    details: completionDetails,
    groupTotal: completionValue,
    remainderTokenType: "output",
  });

  return (
    <Flex direction="column" gap="size-200" css={tokenDetailsBreakdownCSS}>
      <RichTokenBreakdown
        valueLabel={valueLabel}
        totalLabel={totalLabel}
        totalValue={totalValue}
        formatter={formatter}
        segments={segments}
      />
      {/* A lone segment restates the group total, so it is left to the legend above */}
      {promptSegments.length > 1 && (
        <RichTokenBreakdown
          valueLabel={valueLabel}
          totalLabel="Prompt"
          totalValue={promptValue}
          formatter={formatter}
          segments={promptSegments}
        />
      )}
      {completionSegments.length > 1 && (
        <RichTokenBreakdown
          valueLabel={valueLabel}
          totalLabel="Completion"
          totalValue={completionValue}
          formatter={formatter}
          segments={completionSegments}
        />
      )}
    </Flex>
  );
}

/**
 * Turns one group's token-type values into labeled, colored segments.
 *
 * Details refine the authoritative prompt and completion totals but may be
 * incomplete for spans recorded before a token type was tracked. Any positive
 * remainder is attributed to the group's plain token type, so the bar always
 * accounts for the total it is drawn against.
 *
 * @param params - Segment building context.
 * @param params.colors - Theme-aware categorical chart colors.
 * @param params.details - Values keyed by token type.
 * @param params.groupTotal - The prompt or completion total the details refine.
 * @param params.remainderTokenType - Token type that absorbs the unaccounted remainder.
 * @returns Segments in canonical token-type order.
 */
function buildDetailSegments({
  colors,
  details,
  groupTotal,
  remainderTokenType,
}: {
  colors: ReturnType<typeof useCategoryChartColors>;
  details: TokenDetailValues | null | undefined;
  groupTotal: number;
  remainderTokenType: string;
}): DetailSegment[] {
  const valueByTokenType = new Map<string, number>();
  Object.entries(details ?? {}).forEach(([tokenType, value]) => {
    if (value != null && value > 0) {
      valueByTokenType.set(
        tokenType,
        (valueByTokenType.get(tokenType) ?? 0) + value
      );
    }
  });
  if (valueByTokenType.size === 0) {
    return [];
  }

  const detailTotal = Array.from(valueByTokenType.values()).reduce(
    (acc, value) => acc + value,
    0
  );
  const remainder = groupTotal - detailTotal;
  if (remainder > REMAINDER_EPSILON) {
    valueByTokenType.set(
      remainderTokenType,
      (valueByTokenType.get(remainderTokenType) ?? 0) + remainder
    );
  }

  return Array.from(valueByTokenType.entries())
    .sort(([leftType], [rightType]) => compareTokenTypes(leftType, rightType))
    .map(([tokenType, value], index) => ({
      name: getTokenDetailLabel(tokenType),
      value,
      color: getTokenDetailColor({ colors, index, tokenType }),
    }));
}
