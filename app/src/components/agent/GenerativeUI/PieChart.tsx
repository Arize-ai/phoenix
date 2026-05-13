import { Flex } from "@phoenix/components/core/layout";

import { ChartFrame } from "./ChartFrame";
import { chartColors } from "./colors";
import { ChartLegend } from "./Legend";
import type { ChartDatum } from "./types";

export function PieChart({
  title,
  data,
}: {
  title: string | null;
  data: ChartDatum[];
}) {
  const total = data.reduce(
    (sum, datum) => sum + Math.max(0, Math.abs(datum.value)),
    0
  );
  const gradientStops = getPieGradientStops({ data, total });

  return (
    <ChartFrame title={title}>
      <Flex direction="row" gap="size-200" alignItems="center" wrap>
        <div
          aria-label="Generated pie chart"
          role="img"
          style={{
            width: 120,
            height: 120,
            borderRadius: "999px",
            background: `conic-gradient(${gradientStops})`,
          }}
        />
        <ChartLegend data={data} showSwatches />
      </Flex>
    </ChartFrame>
  );
}

function getPieGradientStops({
  data,
  total,
}: {
  data: ChartDatum[];
  total: number;
}) {
  if (total <= 0) {
    return "var(--global-color-gray-300) 0deg 360deg";
  }

  let currentDegree = 0;
  return data
    .map((datum, index) => {
      const degrees = (Math.abs(datum.value) / total) * 360;
      const startDegree = currentDegree;
      const endDegree = currentDegree + degrees;
      currentDegree = endDegree;
      return `${chartColors[index % chartColors.length]} ${startDegree}deg ${endDegree}deg`;
    })
    .join(", ");
}
