import type { MetricsSnapshot, EndpointId } from "../types";
import { ENDPOINT_LABELS } from "../types";

interface Props {
  metrics: MetricsSnapshot | null;
}

export function ConnectionMonitor({ metrics }: Props) {
  if (!metrics) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <h2 className="text-sm font-medium mb-2">Endpoint Activity</h2>
        <div className="text-gray-500 text-xs">Waiting for data...</div>
      </div>
    );
  }

  const endpoints = Object.entries(metrics.endpoints) as [EndpointId, (typeof metrics.endpoints)[EndpointId]][];
  const activeEndpoints = endpoints.filter(([, endpoint]) => endpoint.totalRequests > 0);
  const inactiveCount = endpoints.length - activeEndpoints.length;

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <h2 className="text-sm font-medium mb-2">Endpoint Activity</h2>
      {activeEndpoints.length === 0 ? (
        <div className="text-gray-500 text-xs">No endpoint activity yet</div>
      ) : (
        <div className="space-y-0.5">
          {activeEndpoints.map(([id, endpoint]) => (
            <EndpointRow key={id} id={id} endpoint={endpoint} />
          ))}
          {inactiveCount > 0 && (
            <div className="text-gray-600 text-xs pt-1">+{inactiveCount} inactive</div>
          )}
        </div>
      )}
    </div>
  );
}

function EndpointRow({ id, endpoint }: { id: EndpointId; endpoint: { activeConnections: number; activeStreamingConnections: number; totalRequests: number; totalErrors: number; totalRateLimited: number; requestsPerSecond: number; }; }) {
  const label = ENDPOINT_LABELS[id] || id;
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <div className="flex items-center gap-1.5">
        <div className={`w-1 h-1 rounded-full ${endpoint.activeConnections > 0 ? "bg-green-500" : "bg-gray-600"}`} />
        <span className="text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-2 font-mono text-gray-500">
        <span className={endpoint.activeConnections > 0 ? "text-green-400" : ""}>{endpoint.activeConnections}</span>
        <span>{endpoint.requestsPerSecond}/s</span>
        <span>{endpoint.totalRequests}</span>
        {endpoint.totalErrors > 0 && <span className="text-red-400">{endpoint.totalErrors}err</span>}
      </div>
    </div>
  );
}

