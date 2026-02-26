import type {
  MetricsSnapshot,
  DetailedMetricsSnapshot,
  EndpointId,
} from "../types";
import { ENDPOINT_LABELS } from "../types";

interface Props {
  metrics: MetricsSnapshot | null;
  detailedMetrics?: DetailedMetricsSnapshot | null;
}

export function ConnectionMonitor({ metrics, detailedMetrics }: Props) {
  if (!metrics) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
        <h2 className="mb-2 text-sm font-medium">Endpoint Activity</h2>
        <div className="text-xs text-gray-500">Waiting for data...</div>
      </div>
    );
  }

  const endpoints = Object.entries(metrics.endpoints) as [
    EndpointId,
    (typeof metrics.endpoints)[EndpointId],
  ][];
  const activeEndpoints = endpoints.filter(
    ([, endpoint]) => endpoint.totalRequests > 0
  );
  const inactiveCount = endpoints.length - activeEndpoints.length;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <h2 className="mb-2 text-sm font-medium">Endpoint Activity</h2>
      {activeEndpoints.length === 0 ? (
        <div className="text-xs text-gray-500">No endpoint activity yet</div>
      ) : (
        <div className="space-y-0.5">
          {activeEndpoints.map(([id, endpoint]) => {
            const detailed = detailedMetrics?.endpoints[id];
            return (
              <EndpointRow
                key={id}
                id={id}
                endpoint={endpoint}
                totalStreaming={detailed?.totalStreaming ?? 0}
                totalNonStreaming={detailed?.totalNonStreaming ?? 0}
              />
            );
          })}
          {inactiveCount > 0 && (
            <div className="pt-1 text-xs text-gray-600">
              +{inactiveCount} inactive
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EndpointRowProps {
  id: EndpointId;
  endpoint: {
    activeConnections: number;
    activeStreamingConnections: number;
    totalRequests: number;
    totalErrors: number;
    totalRateLimited: number;
    requestsPerSecond: number;
  };
  totalStreaming: number;
  totalNonStreaming: number;
}

function EndpointRow({
  id,
  endpoint,
  totalStreaming,
  totalNonStreaming,
}: EndpointRowProps) {
  const label = ENDPOINT_LABELS[id] || id;
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <div className="flex items-center gap-1.5">
        <div
          className={`h-1 w-1 rounded-full ${endpoint.activeConnections > 0 ? "bg-green-500" : "bg-gray-600"}`}
        />
        <span className="text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-2 font-mono text-gray-500">
        <span
          className={endpoint.activeConnections > 0 ? "text-green-400" : ""}
        >
          {endpoint.activeConnections}
        </span>
        <span>{endpoint.requestsPerSecond}/s</span>
        <span className="text-cyan-400" title="Streaming">
          {totalStreaming}
        </span>
        <span className="text-gray-600">/</span>
        <span className="text-orange-400" title="Non-streaming">
          {totalNonStreaming}
        </span>
        {endpoint.totalErrors > 0 && (
          <span className="text-red-400">{endpoint.totalErrors}err</span>
        )}
      </div>
    </div>
  );
}
