import {
  getChartColor,
  useChartColors,
} from "@phoenix/components/chart/colors";
import { SegmentChart } from "@phoenix/components/chart/SegmentChart";
import { Text } from "@phoenix/components/content";
import { Flex } from "@phoenix/components/layout";

type RichTokenCostBreakdownProps = {
  valueLabel: string;
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
  totalValue,
  formatter,
  segments,
}: RichTokenCostBreakdownProps) {
  const colors = useChartColors();
  const segmentsWithColor = segments.map((segment, index) => ({
    ...segment,
    color: segment.color || getChartColor(index, colors),
  }));
  return (
    <Flex direction="column" gap="size-150">
      {/* Totals */}
      <Flex direction="row" gap="size-200" justifyContent="space-between">
        <Text weight="heavy">Total {valueLabel}</Text>
        <Flex direction="row" gap="size-400">
          <Text weight="heavy">{formatter(totalValue)}</Text>
        </Flex>
      </Flex>
      {/* Segment graph */}
      <SegmentChart
        height={6}
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
