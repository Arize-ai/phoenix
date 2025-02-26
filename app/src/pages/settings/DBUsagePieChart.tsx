import React from "react";
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
import { storageSizeFomatter } from "@phoenix/utils/storageSizeFormatUtils";

import { DBUsagePieChart_data$key } from "./__generated__/DBUsagePieChart_data.graphql";

function TooltipContent({ active, payload }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        <ChartTooltipItem
          shape="square"
          color={payload[0].payload.fill || "transparent"}
          name={payload[0].name || "--"}
          value={storageSizeFomatter(payload[0].value || 0)}
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
      }
    `,
    query
  );

  const totalBytes = data.dbTableStats.reduce(
    (acc, table) => acc + table.numBytes,
    0
  );

  return (
    <ResponsiveContainer width="100%" height={245}>
      <PieChart>
        <Pie
          data={[...data.dbTableStats]}
          dataKey="numBytes"
          nameKey="tableName"
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          strokeWidth={0}
          stroke="transparent"
        >
          {data.dbTableStats.map((x, index) => (
            <Cell
              stroke="0"
              key={`cell-${index}`}
              fill={`${schemePaired[index % schemePaired.length]}`}
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
          {`${storageSizeFomatter(totalBytes)}`}
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
