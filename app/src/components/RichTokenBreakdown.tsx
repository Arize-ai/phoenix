import {
  getChartColor,
  SegmentChart,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { Text } from "@phoenix/components/core/content";
import { Flex } from "@phoenix/components/core/layout";

type RichTokenBreakdownProps = {
  /**
   * The noun for the value being broken down, e.g. "cost" or "tokens".
   */
  valueLabel: string;
  /**
   * Qualifies the total, e.g. "Total" or "Average". Rendered ahead of the
   * value label, so `Prompt` and `cost` read as "Prompt cost".
   * @default "Total"
   */
  totalLabel?: string;
  totalValue: number;
  formatter: (value: number) => string;
  segments: {
    name: string;
    value: number;
    color?: string;
  }[];
};

export function RichTokenBreakdown({
  valueLabel,
  totalLabel = "Total",
  totalValue,
  formatter,
  segments,
}: RichTokenBreakdownProps) {
  const colors = useSequentialChartColors();
  const segmentsWithColor = segments.map((segment, index) => ({
    ...segment,
    color: segment.color || getChartColor(index, colors),
  }));
  return (
    <Flex direction="column" gap="size-150">
      {/* Totals */}
      <Flex direction="row" gap="size-200" justifyContent="space-between">
        <Text weight="heavy">{`${totalLabel} ${valueLabel}`}</Text>
        <Flex direction="row" gap="size-400">
          <Text weight="heavy">{formatter(totalValue)}</Text>
        </Flex>
      </Flex>
      {/* Segment graph */}
      <SegmentChart
        height={6}
        minimumSegmentPercentage={1}
        totalValue={totalValue}
        segments={segmentsWithColor}
      />
      {/* Segment table */}
      <Flex direction="column" gap="size-100">
        {segmentsWithColor.map((segment) => {
          return (
            <Flex
              key={segment.name}
              direction="row"
              gap="size-200"
              justifyContent="space-between"
            >
              <Flex direction="row" gap="size-100" alignItems="center">
                <div
                  style={{
                    backgroundColor: segment.color,
                    width: 8,
                    height: 8,
                    borderRadius: "100%",
                  }}
                />
                <Text weight="heavy">{segment.name}</Text>
              </Flex>
              <Flex direction="row" gap="size-400">
                <Text weight="heavy">{formatter(segment.value)}</Text>
              </Flex>
            </Flex>
          );
        })}
      </Flex>
    </Flex>
  );
}
