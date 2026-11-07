import { useState } from "react";

import { ConcurrentConnectionsChart } from "./components/ConcurrentConnectionsChart";
import { ConnectionMonitor } from "./components/ConnectionMonitor";
import { EventLog } from "./components/EventLog";
import { ProviderControls } from "./components/ProviderControls";
import { ThroughputChart } from "./components/ThroughputChart";
import { TimeRangeSelector } from "./components/TimeRangeSelector";
import { useWebSocket } from "./hooks/useWebSocket";
import { PROVIDER_GROUPS, type EndpointConfig } from "./types";
import { publicUrl } from "./utils/publicPath";
import type { TimeRange } from "./utils/timeRange";

function App() {
  const [timeRange, setTimeRange] = useState<TimeRange>("5m");
  const {
    connected,
    metrics,
    detailedMetrics,
    config,
    events,
    updateEndpointConfig,
    resetConfig,
    resetDetailedMetrics,
    resetRateLimiters,
  } = useWebSocket();

  const updateProvider = (
    endpoints: (typeof PROVIDER_GROUPS)[number]["endpoints"],
    updates: Partial<EndpointConfig>
  ) => {
    for (const endpoint of endpoints) {
      updateEndpointConfig(endpoint, updates);
    }
  };

  const handleExportJSON = () => {
    window.open(publicUrl("/api/detailed-metrics/export/json"), "_blank");
  };

  const handleExportCSV = () => {
    window.open(publicUrl("/api/detailed-metrics/export/csv"), "_blank");
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
        <div className="mb-2 flex justify-end">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="mb-3 space-y-3">
          {PROVIDER_GROUPS.map((provider) => (
            <div
              key={provider.id}
              className="grid items-stretch gap-3 lg:grid-cols-3"
            >
              <ThroughputChart
                detailedMetrics={detailedMetrics}
                timeRange={timeRange}
                endpointIds={provider.endpoints}
                providerLabel={provider.label}
              />
              <ConcurrentConnectionsChart
                detailedMetrics={detailedMetrics}
                timeRange={timeRange}
                endpointIds={provider.endpoints}
                providerLabel={provider.label}
              />
              <ProviderControls
                provider={provider}
                config={config}
                onUpdate={(updates) =>
                  updateProvider(provider.endpoints, updates)
                }
              />
            </div>
          ))}
        </div>

        <div className="mb-3">
          <ConnectionMonitor
            metrics={metrics}
            detailedMetrics={detailedMetrics}
          />
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
