import { useState } from "react";

import { ConcurrentConnectionsChart } from "./components/ConcurrentConnectionsChart";
import { ConnectionMonitor } from "./components/ConnectionMonitor";
import { ConnectionsChart } from "./components/ConnectionsChart";
import { EventLog } from "./components/EventLog";
import { FailureModes } from "./components/FailureModes";
import { LatencyControls } from "./components/LatencyControls";
import { RateLimitPanel } from "./components/RateLimitPanel";
import { ThroughputChart } from "./components/ThroughputChart";
import { TimeRangeSelector } from "./components/TimeRangeSelector";
import { useWebSocket } from "./hooks/useWebSocket";
import type { TimeRange } from "./utils/timeRange";

function App() {
  const [timeRange, setTimeRange] = useState<TimeRange>("5m");
  const {
    connected,
    metrics,
    detailedMetrics,
    config,
    events,
    updateGlobalConfig,
    resetConfig,
    resetDetailedMetrics,
    resetRateLimiters,
  } = useWebSocket();

  const handleExportJSON = () => {
    window.open("/api/detailed-metrics/export/json", "_blank");
  };

  const handleExportCSV = () => {
    window.open("/api/detailed-metrics/export/csv", "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-sm text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">Mock LLM Server</h1>
            <span
              className={`rounded px-1.5 py-0.5 text-xs ${
                connected ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {connected ? "Connected" : "Disconnected"}
            </span>
            {detailedMetrics && (
              <div className="ml-4 flex items-center gap-4 text-xs">
                <Stat
                  label="Active"
                  value={detailedMetrics.global.currentConnections}
                  color="blue"
                />
                <Stat
                  label="RPS"
                  value={detailedMetrics.global.currentRPS}
                  peak={detailedMetrics.global.peaks.maxRPS}
                  color="green"
                />
                <Stat
                  label="Total"
                  value={detailedMetrics.global.peaks.totalConnections}
                  color="purple"
                />
                <span className="flex items-center gap-1 text-gray-500">
                  (
                  <span className="font-mono text-cyan-400">
                    {detailedMetrics.global.totalStreaming}
                  </span>{" "}
                  stream
                  <span className="text-gray-600">/</span>
                  <span className="font-mono text-orange-400">
                    {detailedMetrics.global.totalNonStreaming}
                  </span>{" "}
                  sync)
                </span>
                <Stat
                  label="Errors"
                  value={detailedMetrics.global.peaks.totalErrors}
                  color={
                    detailedMetrics.global.peaks.totalErrors > 0
                      ? "red"
                      : "gray"
                  }
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportJSON}
              className="rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600"
            >
              JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600"
            >
              CSV
            </button>
            <button
              onClick={resetRateLimiters}
              className="rounded bg-yellow-600/80 px-2 py-1 text-xs hover:bg-yellow-600"
            >
              Reset Limits
            </button>
            <button
              onClick={resetDetailedMetrics}
              className="rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600"
            >
              Reset Metrics
            </button>
            <button
              onClick={resetConfig}
              className="rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600"
            >
              Reset Config
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-3">
        {/* Charts Row */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">Time Series</span>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="mb-3 grid grid-cols-3 gap-3">
          <ThroughputChart
            detailedMetrics={detailedMetrics}
            timeRange={timeRange}
          />
          <ConcurrentConnectionsChart
            detailedMetrics={detailedMetrics}
            timeRange={timeRange}
          />
          <ConnectionsChart
            detailedMetrics={detailedMetrics}
            timeRange={timeRange}
          />
        </div>

        {/* Controls Row */}
        <div className="mb-3 grid grid-cols-4 gap-3">
          <ConnectionMonitor
            metrics={metrics}
            detailedMetrics={detailedMetrics}
          />
          <LatencyControls config={config} onUpdate={updateGlobalConfig} />
          <RateLimitPanel config={config} onUpdate={updateGlobalConfig} />
          <FailureModes config={config} onUpdate={updateGlobalConfig} />
        </div>

        {/* Event Log - Full Width */}
        <EventLog events={events} />
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  peak,
  color,
}: {
  label: string;
  value: number;
  peak?: number;
  color: "blue" | "green" | "purple" | "red" | "gray";
}) {
  const colors = {
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
    red: "text-red-400",
    gray: "text-gray-500",
  };

  return (
    <span className="flex items-center gap-1">
      <span className="text-gray-500">{label}:</span>
      <span className={`font-mono ${colors[color]}`}>{value}</span>
      {peak !== undefined && (
        <span className="text-gray-600">(peak {peak})</span>
      )}
    </span>
  );
}

export default App;
