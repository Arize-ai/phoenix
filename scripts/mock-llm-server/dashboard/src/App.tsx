import { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { ConnectionMonitor } from "./components/ConnectionMonitor";
import { ThroughputChart } from "./components/ThroughputChart";
import { ConnectionsChart } from "./components/ConnectionsChart";
import { ConcurrentConnectionsChart } from "./components/ConcurrentConnectionsChart";
import { LatencyControls } from "./components/LatencyControls";
import { RateLimitPanel } from "./components/RateLimitPanel";
import { FailureModes } from "./components/FailureModes";
import { EventLog } from "./components/EventLog";
import { TimeRangeSelector } from "./components/TimeRangeSelector";
import type { TimeRange } from "./utils/timeRange";

function App() {
  const [timeRange, setTimeRange] = useState<TimeRange>("10m");
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
    <div className="min-h-screen bg-gray-900 text-white text-sm">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">Mock LLM Server</h1>
            <span
              className={`px-1.5 py-0.5 rounded text-xs ${
                connected ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {connected ? "Connected" : "Disconnected"}
            </span>
            {detailedMetrics && (
              <div className="flex items-center gap-4 ml-4 text-xs">
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
                  <span className="text-cyan-400 font-mono">
                    {detailedMetrics.global.totalStreaming}
                  </span>{" "}
                  stream
                  <span className="text-gray-600">/</span>
                  <span className="text-orange-400 font-mono">
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
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              CSV
            </button>
            <button
              onClick={resetRateLimiters}
              className="px-2 py-1 bg-yellow-600/80 hover:bg-yellow-600 rounded text-xs"
            >
              Reset Limits
            </button>
            <button
              onClick={resetDetailedMetrics}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              Reset Metrics
            </button>
            <button
              onClick={resetConfig}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              Reset Config
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-3">
        {/* Charts Row */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500">Time Series</span>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
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
        <div className="grid grid-cols-4 gap-3 mb-3">
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
