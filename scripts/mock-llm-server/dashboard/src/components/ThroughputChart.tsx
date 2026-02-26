import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import type { DetailedMetricsSnapshot } from "../types";
import { type TimeRange, getTimeRangeMs } from "../utils/timeRange";

interface Props {
  detailedMetrics: DetailedMetricsSnapshot | null;
  timeRange: TimeRange;
}

export function ThroughputChart({ detailedMetrics, timeRange }: Props) {
  if (!detailedMetrics || detailedMetrics.global.timeSeries.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
        <h2 className="mb-2 text-sm font-medium">
          Requests Completed per Second
        </h2>
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
    rps: point.requestsCompleted + point.requestsFailed,
  }));

  const { peaks } = detailedMetrics.global;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">Requests Completed per Second</h2>
        <div className="flex gap-2 text-xs">
          <span className="text-gray-500">
            now{" "}
            <span className="font-mono text-green-400">
              {detailedMetrics.global.currentRPS}
            </span>
          </span>
          <span className="text-gray-500">
            peak{" "}
            <span className="font-mono text-green-400">{peaks.maxRPS}</span>
          </span>
        </div>
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
            <ReferenceLine
              y={peaks.maxRPS}
              stroke="#10b981"
              strokeDasharray="3 3"
            />
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
    </div>
  );
}
