import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { DetailedMetricsSnapshot } from "../types";

interface Props {
  detailedMetrics: DetailedMetricsSnapshot | null;
}

export function ConcurrentConnectionsChart({ detailedMetrics }: Props) {
  if (!detailedMetrics || detailedMetrics.global.timeSeries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <h2 className="text-sm font-medium mb-2">Active Requests (In-Flight)</h2>
        <div className="h-64 flex items-center justify-center text-gray-500 text-xs">
          Collecting data...
        </div>
      </div>
    );
  }

  const data = detailedMetrics.global.timeSeries.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString(),
    concurrent: point.activeConnections,
  }));

  const { peaks } = detailedMetrics.global;
  const currentConnections = detailedMetrics.global.currentConnections;

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium">Active Requests (In-Flight)</h2>
        <div className="flex gap-2 text-xs">
          <span className="text-gray-500">now <span className="text-blue-400 font-mono">{currentConnections}</span></span>
          <span className="text-gray-500">peak <span className="text-blue-400 font-mono">{peaks.maxConcurrentConnections}</span></span>
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
              stroke="#3b82f6"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={[0, "auto"]}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "0.5rem",
              }}
              labelStyle={{ color: "#9ca3af" }}
            />
            {peaks.maxConcurrentConnections > 0 && (
              <ReferenceLine 
                y={peaks.maxConcurrentConnections} 
                stroke="#3b82f6" 
                strokeDasharray="3 3" 
              />
            )}
            <Line
              type="monotone"
              dataKey="concurrent"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Active Connections"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
