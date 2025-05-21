import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { schemePaired } from "d3-scale-chromatic";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
} from "recharts";

import { ChartTooltip, ChartTooltipItem } from "@phoenix/components/chart";
import { percentFormatter } from "@phoenix/utils/numberFormatUtils";
import { storageSizeFormatter } from "@phoenix/utils/storageSizeFormatUtils";

import { DBUsagePieChart_data$key } from "./__generated__/DBUsagePieChart_data.graphql";

const REMAINING_TEXT = "remaining";
function TooltipContent({ active, payload }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        <ChartTooltipItem
          shape="square"
          color={payload[0].payload.fill || "transparent"}
          name={payload[0].name || "--"}
          value={storageSizeFormatter(payload[0].value || 0)}
        />
      </ChartTooltip>
    );
  }

  return null;
}

export function DBUsagePieChart({
  query,
}: {
  query: DBUsagePieChart_data$key;
}) {
  const data = useFragment<DBUsagePieChart_data$key>(
    graphql`
      fragment DBUsagePieChart_data on Query {
        dbTableStats {
          tableName
          numBytes
        }
        dbStorageCapacityBytes
      }
    `,
    query
  );

  const totalUsedBytes = data.dbTableStats.reduce(
    (acc, table) => acc + table.numBytes,
    0
  );
  const remainingBytes =
    typeof data.dbStorageCapacityBytes === "number"
      ? data.dbStorageCapacityBytes - totalUsedBytes
      : null;
  const chartData = useMemo(() => {
    const chartData = [...data.dbTableStats];
    if (remainingBytes !== null) {
      chartData.push({
        tableName: REMAINING_TEXT,
        numBytes: remainingBytes,
      });
    }
    return chartData;
  }, [data.dbTableStats, remainingBytes]);
  return (
    <ResponsiveContainer width="100%" height={245}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="numBytes"
          nameKey="tableName"
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          strokeWidth={0}
          stroke="transparent"
        >
          {chartData.map((x, index) => (
            <Cell
              stroke="0"
              key={`cell-${index}`}
              fill={
                x.tableName === REMAINING_TEXT
                  ? "var(--ac-global-color-grey-200)"
                  : `${schemePaired[index % schemePaired.length]}`
              }
            />
          ))}
        </Pie>
        <Tooltip content={<TooltipContent />} />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          fill="var(--ac-global-text-color-900"
          fontSize="var(--ac-global-font-size-xl)"
        >
          {`${typeof data.dbStorageCapacityBytes === "number" ? percentFormatter((totalUsedBytes / data.dbStorageCapacityBytes) * 100) : storageSizeFormatter(totalUsedBytes)}`}
        </text>
        <text
          x="50%"
          y="50%"
          dy={25}
          textAnchor="middle"
          fill="var(--ac-global-text-color-900"
          fontSize="var(--ac-global-font-size-s)"
        >
          {`Used`}
        </text>
        <g>
          <text
            x="100%"
            y="100%"
            dx={-80}
            dy={-2}
            textAnchor="right"
            fill="var(--ac-global-text-color-500)"
            fontSize="var(--ac-global-font-size-xs)"
          >
            {"* approximate"}
          </text>
        </g>
      </PieChart>
    </ResponsiveContainer>
  );
}
