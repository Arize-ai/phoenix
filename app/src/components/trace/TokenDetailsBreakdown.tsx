import { Flex } from "@phoenix/components";
import { useCategoryChartColors } from "@phoenix/components/chart";
import { RichTokenBreakdown } from "@phoenix/components/RichTokenBreakdown";
import {
  compareTokenTypes,
  getRemainderTokenType,
  getTokenDetailColor,
  getTokenDetailLabel,
  TOKEN_DETAIL_EPSILON,
} from "@phoenix/utils/tokenDetailUtils";

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

  const groups = [
    {
      label: "Prompt",
      isPrompt: true,
      value: prompt,
      details: promptDetails,
      color: colors.category1,
    },
    {
      label: "Completion",
      isPrompt: false,
      value: completion,
      details: completionDetails,
      color: colors.category2,
    },
  ].map((group) => ({
    ...group,
    // An absent group is left out of the split entirely; a zero one still
    // belongs in the legend.
    value: group.value ?? 0,
    isPresent: group.value != null,
    segments: buildDetailSegments({
      colors,
      details: group.details,
      groupTotal: group.value ?? 0,
      isPrompt: group.isPrompt,
    }),
  }));

  return (
    <Flex direction="column" gap="size-200" minWidth="size-3000">
      <RichTokenBreakdown
        valueLabel={valueLabel}
        totalLabel={totalLabel}
        totalValue={
          total ?? groups.reduce((acc, group) => acc + group.value, 0)
        }
        formatter={formatter}
        segments={groups
          .filter((group) => group.isPresent)
          .map(({ label, value, color }) => ({ name: label, value, color }))}
      />
      {/* A lone segment restates the group total, so it is left to the legend above */}
      {groups
        .filter((group) => group.segments.length > 1)
        .map((group) => (
          <RichTokenBreakdown
            key={group.label}
            valueLabel={valueLabel}
            totalLabel={group.label}
            totalValue={group.value}
            formatter={formatter}
            segments={group.segments}
          />
        ))}
    </Flex>
  );
}

/**
 * Turns one group's token-type values into labeled, colored segments.
 *
 * Any value the details do not account for is attributed to the group's plain
 * token type, so the bar always adds up to the total it is drawn against.
 *
 * @param params - Segment building context.
 * @param params.colors - Theme-aware categorical chart colors.
 * @param params.details - Values keyed by token type.
 * @param params.groupTotal - The prompt or completion total the details refine.
 * @param params.isPrompt - Whether the group holds prompt rather than completion usage.
 * @returns Segments in canonical token-type order.
 */
function buildDetailSegments({
  colors,
  details,
  groupTotal,
  isPrompt,
}: {
  colors: ReturnType<typeof useCategoryChartColors>;
  details: TokenDetailValues | null | undefined;
  groupTotal: number;
  isPrompt: boolean;
}): DetailSegment[] {
  const values: Record<string, number> = {};
  let detailTotal = 0;
  Object.entries(details ?? {}).forEach(([tokenType, value]) => {
    if (value != null && value > 0) {
      values[tokenType] = value;
      detailTotal += value;
    }
  });
  if (detailTotal === 0) {
    return [];
  }

  const remainder = groupTotal - detailTotal;
  if (remainder > TOKEN_DETAIL_EPSILON) {
    const tokenType = getRemainderTokenType(isPrompt);
    values[tokenType] = (values[tokenType] ?? 0) + remainder;
  }

  return Object.entries(values)
    .sort(([leftType], [rightType]) => compareTokenTypes(leftType, rightType))
    .map(([tokenType, value], index) => ({
      name: getTokenDetailLabel(tokenType),
      value,
      color: getTokenDetailColor({ colors, index, tokenType }),
    }));
}
