import type { ReactNode } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import type { DetailedMetricsSnapshot, EndpointId } from "../types";
import { providerSeries } from "../utils/providerSeries";
import type { TimeRange } from "../utils/timeRange";

interface Props {
  detailedMetrics: DetailedMetricsSnapshot | null;
  timeRange: TimeRange;
  endpointIds: readonly EndpointId[];
  providerLabel: string;
}

export function ThroughputChart({
  detailedMetrics,
  timeRange,
  endpointIds,
  providerLabel,
}: Props) {
  const series = detailedMetrics
    ? providerSeries(detailedMetrics, endpointIds, timeRange)
    : null;

  if (!series || series.points.length === 0) {
    return (
      <ChartCard providerLabel={providerLabel}>
        <div className="flex min-h-32 flex-1 items-center justify-center text-xs text-gray-500">
          Collecting data...
        </div>
      </ChartCard>
    );
  }

  const data = series.points.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString(),
    rps: point.rps,
  }));

  return (
    <ChartCard
      providerLabel={providerLabel}
      stats={
        <div className="flex gap-2 text-xs">
          <span className="text-gray-500">
            now{" "}
            <span className="font-mono text-green-400">
              {series.currentRPS}
            </span>
          </span>
          <span className="text-gray-500">
            peak{" "}
            <span className="font-mono text-green-400">{series.peakRPS}</span>
          </span>
        </div>
      }
    >
      <div className="min-h-32 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="time"
              stroke="#6b7280"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              orientation="right"
              stroke="#10b981"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "0.5rem",
              }}
              labelStyle={{ color: "#9ca3af" }}
            />
            {series.peakRPS > 0 && (
              <ReferenceLine
                y={series.peakRPS}
                stroke="#10b981"
                strokeDasharray="3 3"
              />
            )}
            <Line
              type="monotone"
              dataKey="rps"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Requests/sec"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function ChartCard({
  providerLabel,
  stats,
  children,
}: {
  providerLabel: string;
  stats?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-700 bg-gray-800 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          <span className="text-gray-400">{providerLabel}</span>
          <span className="text-gray-600"> · </span>
          Requests / sec
        </h2>
        {stats}
      </div>
      {children}
    </div>
  );
}
