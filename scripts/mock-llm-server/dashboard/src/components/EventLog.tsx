import type { ConnectionEvent, EndpointId } from "../types";
import { ENDPOINT_LABELS } from "../types";

interface Props {
  events: ConnectionEvent[];
}

export function EventLog({ events }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <h2 className="text-sm font-medium mb-2">Event Log</h2>
      <div className="h-40 overflow-y-auto font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-gray-500">No events yet...</div>
        ) : (
          <table className="w-full">
            <thead className="text-left text-gray-500 sticky top-0 bg-gray-800">
              <tr>
                <th className="pb-1 pr-3">Time</th>
                <th className="pb-1 pr-3">Type</th>
                <th className="pb-1 pr-3">Endpoint</th>
                <th className="pb-1">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <EventRow key={i} event={event} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: ConnectionEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const typeColors: Record<ConnectionEvent["type"], string> = {
    request_start: "text-blue-400",
    request_end: "text-green-400",
    connection_open: "text-blue-400",
    connection_close: "text-gray-400",
    error: "text-red-400",
    rate_limited: "text-yellow-400",
  };

  const typeLabels: Record<ConnectionEvent["type"], string> = {
    request_start: "START",
    request_end: "END",
    connection_open: "OPEN",
    connection_close: "CLOSE",
    error: "ERR",
    rate_limited: "LIMIT",
  };

  let details = "";
  if (event.latencyMs) details = `${event.latencyMs}ms`;
  if (event.streaming) details += details ? " stream" : "stream";
  if (event.error) details = event.error;

  const label = ENDPOINT_LABELS[event.endpoint as EndpointId] || event.endpoint;

  return (
    <tr className="border-t border-gray-700/30">
      <td className="py-0.5 pr-3 text-gray-600">{time}</td>
      <td className={`py-0.5 pr-3 ${typeColors[event.type]}`}>{typeLabels[event.type]}</td>
      <td className="py-0.5 pr-3 text-gray-400">{label}</td>
      <td className="py-0.5 text-gray-500">{details}</td>
    </tr>
  );
}
