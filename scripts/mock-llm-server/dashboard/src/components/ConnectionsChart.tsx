import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { DetailedMetricsSnapshot } from "../types";
import { type TimeRange, getTimeRangeMs } from "../utils/timeRange";

interface Props {
  detailedMetrics: DetailedMetricsSnapshot | null;
  timeRange: TimeRange;
}

export function ConnectionsChart({ detailedMetrics, timeRange }: Props) {
  if (!detailedMetrics || detailedMetrics.global.timeSeries.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
        <h2 className="mb-2 text-sm font-medium">Cumulative Requests</h2>
        <div className="flex h-64 items-center justify-center text-xs text-gray-500">
          Collecting data...
        </div>
      </div>
    );
  }

  const cutoffTime = detailedMetrics.timestamp - getTimeRangeMs(timeRange);
  const filteredSeries = detailedMetrics.global.timeSeries.filter(
    (point) => point.timestamp >= cutoffTime
  );

  const data = filteredSeries.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString(),
    cumulative: point.cumulativeConnections,
  }));

  const { peaks } = detailedMetrics.global;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">Cumulative Requests</h2>
        <span className="text-xs text-gray-500">
          total{" "}
          <span className="font-mono text-purple-400">
            {peaks.totalConnections}
          </span>
        </span>
      </div>
      <div className="h-64">
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
              stroke="#a855f7"
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
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              name="Cumulative Connections"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
