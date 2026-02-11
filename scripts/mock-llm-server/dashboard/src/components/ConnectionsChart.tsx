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
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <h2 className="text-sm font-medium mb-2">Cumulative Requests</h2>
        <div className="h-64 flex items-center justify-center text-gray-500 text-xs">
          Collecting data...
        </div>
      </div>
    );
  }

  const cutoffTime = detailedMetrics.timestamp - getTimeRangeMs(timeRange);
  const filteredSeries = detailedMetrics.global.timeSeries.filter(
    (point) => point.timestamp >= cutoffTime,
  );

  const data = filteredSeries.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString(),
    cumulative: point.cumulativeConnections,
  }));

  const { peaks } = detailedMetrics.global;

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium">Cumulative Requests</h2>
        <span className="text-xs text-gray-500">
          total{" "}
          <span className="text-purple-400 font-mono">
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
