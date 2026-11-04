import type { DetailedMetricsSnapshot, EndpointId } from "../types";
import { type TimeRange, getTimeRangeMs } from "./timeRange";

export interface ProviderSeriesPoint {
  timestamp: number;
  rps: number;
  active: number;
}

export interface ProviderSeries {
  points: ProviderSeriesPoint[];
  currentRPS: number;
  currentConnections: number;
  peakRPS: number;
  peakConnections: number;
}

/** Sum a provider's endpoint series. Peaks cover the retained history, not only the visible window. */
export function providerSeries(
  detailedMetrics: DetailedMetricsSnapshot,
  endpointIds: readonly EndpointId[],
  timeRange: TimeRange
): ProviderSeries {
  const cutoff = detailedMetrics.timestamp - getTimeRangeMs(timeRange);
  const byTime = new Map<number, { rps: number; active: number }>();
  let currentRPS = 0;
  let currentConnections = 0;
  let peakRPS = 0;
  let peakConnections = 0;

  for (const id of endpointIds) {
    const endpoint = detailedMetrics.endpoints[id];
    if (!endpoint) continue;
    currentRPS += endpoint.currentRPS;
    currentConnections += endpoint.currentConnections;
    for (const point of endpoint.timeSeries) {
      const bucket = byTime.get(point.timestamp) ?? { rps: 0, active: 0 };
      bucket.rps += point.requestsCompleted + point.requestsFailed;
      bucket.active += point.activeConnections;
      byTime.set(point.timestamp, bucket);
    }
  }

  const history = [...byTime.entries()].sort((a, b) => a[0] - b[0]);
  for (const [, value] of history) {
    peakRPS = Math.max(peakRPS, value.rps);
    peakConnections = Math.max(peakConnections, value.active);
  }

  return {
    points: history
      .filter(([timestamp]) => timestamp >= cutoff)
      .map(([timestamp, value]) => ({
        timestamp,
        rps: value.rps,
        active: value.active,
      })),
    currentRPS,
    currentConnections,
    peakRPS: Math.max(peakRPS, currentRPS),
    peakConnections: Math.max(peakConnections, currentConnections),
  };
}
