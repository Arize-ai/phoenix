import { EventEmitter } from "events";
import { ENDPOINT_IDS, type EndpointId } from "./providers/types.js";

// Re-export EndpointId for convenience
export type { EndpointId } from "./providers/types.js";

// Event types
export interface ConnectionEvent {
  type:
    | "connection_open"
    | "connection_close"
    | "request_start"
    | "request_end"
    | "error"
    | "rate_limited";
  endpoint: EndpointId;
  timestamp: number;
  requestId?: string;
  error?: string;
  latencyMs?: number;
  streaming?: boolean;
}

// Per-endpoint metrics
export interface EndpointMetrics {
  activeConnections: number;
  activeStreamingConnections: number;
  totalRequests: number;
  totalCompleted: number;
  totalErrors: number;
  totalRateLimited: number;
  latencies: number[]; // Last 1000 latencies for percentile calculation
  completedTimestamps: number[]; // Last 60 seconds of COMPLETED requests for RPS
}

// Snapshot for dashboard
export interface MetricsSnapshot {
  timestamp: number;
  endpoints: Record<
    EndpointId,
    EndpointMetrics & { requestsPerSecond: number }
  >;
  global: {
    totalActiveConnections: number;
    totalRequestsPerSecond: number;
    uptimeSeconds: number;
  };
}

class MetricsCollector extends EventEmitter {
  private metrics: Map<EndpointId, EndpointMetrics> = new Map();
  private startTime: number = Date.now();
  private activeRequests: Map<
    string,
    { endpoint: EndpointId; startTime: number; streaming: boolean }
  > = new Map();

  constructor() {
    super();
    this.initializeMetrics();
    // Clean up old timestamps every second
    setInterval(() => this.cleanupOldTimestamps(), 1000);
  }

  private initializeMetrics(): void {
    for (const endpoint of ENDPOINT_IDS) {
      this.metrics.set(endpoint, {
        activeConnections: 0,
        activeStreamingConnections: 0,
        totalRequests: 0,
        totalCompleted: 0,
        totalErrors: 0,
        totalRateLimited: 0,
        latencies: [],
        completedTimestamps: [],
      });
    }
  }

  private cleanupOldTimestamps(): void {
    const cutoff = Date.now() - 60000; // Keep last 60 seconds
    for (const metrics of this.metrics.values()) {
      metrics.completedTimestamps = metrics.completedTimestamps.filter(
        (t) => t > cutoff,
      );
    }
  }

  private getMetrics(endpoint: EndpointId): EndpointMetrics {
    let metrics = this.metrics.get(endpoint);
    if (!metrics) {
      metrics = {
        activeConnections: 0,
        activeStreamingConnections: 0,
        totalRequests: 0,
        totalCompleted: 0,
        totalErrors: 0,
        totalRateLimited: 0,
        latencies: [],
        completedTimestamps: [],
      };
      this.metrics.set(endpoint, metrics);
    }
    return metrics;
  }

  /**
   * Called when a request starts
   */
  requestStart(
    endpoint: EndpointId,
    requestId: string,
    streaming: boolean,
  ): void {
    // Guard against duplicate starts
    if (this.activeRequests.has(requestId)) {
      return;
    }

    const metrics = this.getMetrics(endpoint);
    metrics.activeConnections++;
    metrics.totalRequests++;

    if (streaming) {
      metrics.activeStreamingConnections++;
    }

    this.activeRequests.set(requestId, {
      endpoint,
      startTime: Date.now(),
      streaming,
    });

    const event: ConnectionEvent = {
      type: "request_start",
      endpoint,
      timestamp: Date.now(),
      requestId,
      streaming,
    };
    this.emit("event", event);
    this.emit("metrics", this.getSnapshot());
  }

  /**
   * Called when a request completes successfully
   */
  requestEnd(requestId: string): void {
    const request = this.activeRequests.get(requestId);
    if (!request) return;

    // Delete first to prevent double-counting
    this.activeRequests.delete(requestId);

    const metrics = this.getMetrics(request.endpoint);
    metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
    metrics.totalCompleted++;

    if (request.streaming) {
      metrics.activeStreamingConnections = Math.max(
        0,
        metrics.activeStreamingConnections - 1,
      );
    }

    const now = Date.now();
    const latency = now - request.startTime;

    // Record completion timestamp for RPS (completed requests only)
    metrics.completedTimestamps.push(now);

    // Record latency
    metrics.latencies.push(latency);
    // Keep last 1000 latencies for better percentile accuracy
    if (metrics.latencies.length > 1000) {
      metrics.latencies.shift();
    }

    const event: ConnectionEvent = {
      type: "request_end",
      endpoint: request.endpoint,
      timestamp: now,
      requestId,
      latencyMs: latency,
      streaming: request.streaming,
    };
    this.emit("event", event);
    this.emit("metrics", this.getSnapshot());
  }

  /**
   * Called when a request errors
   */
  requestError(requestId: string, error: string): void {
    const request = this.activeRequests.get(requestId);
    if (!request) return;

    // Delete first to prevent double-counting
    this.activeRequests.delete(requestId);

    const now = Date.now();
    const metrics = this.getMetrics(request.endpoint);
    metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
    metrics.totalErrors++;

    if (request.streaming) {
      metrics.activeStreamingConnections = Math.max(
        0,
        metrics.activeStreamingConnections - 1,
      );
    }

    // Record latency for failed requests too (important for accurate percentiles)
    const latency = now - request.startTime;
    metrics.latencies.push(latency);
    if (metrics.latencies.length > 1000) {
      metrics.latencies.shift();
    }

    const event: ConnectionEvent = {
      type: "error",
      endpoint: request.endpoint,
      timestamp: now,
      requestId,
      error,
      latencyMs: latency,
    };
    this.emit("event", event);
    this.emit("metrics", this.getSnapshot());
  }

  /**
   * Called when a request is rate limited
   * Note: Rate-limited requests do NOT count toward RPS (they weren't processed)
   */
  rateLimited(endpoint: EndpointId): void {
    const metrics = this.getMetrics(endpoint);
    metrics.totalRateLimited++;
    // Don't add to completedTimestamps - rate limited requests don't count as throughput

    const event: ConnectionEvent = {
      type: "rate_limited",
      endpoint,
      timestamp: Date.now(),
    };
    this.emit("event", event);
    this.emit("metrics", this.getSnapshot());
  }

  /**
   * Get current metrics snapshot
   * RPS is calculated from COMPLETED requests in the last second (true throughput)
   */
  getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    const endpoints: Record<
      string,
      EndpointMetrics & { requestsPerSecond: number }
    > = {};
    let totalActiveConnections = 0;
    let totalRequestsPerSecond = 0;

    for (const [endpoint, metrics] of this.metrics) {
      // RPS = completed requests in last second (actual throughput)
      const rps = metrics.completedTimestamps.filter(
        (t) => t > oneSecondAgo,
      ).length;
      totalActiveConnections += metrics.activeConnections;
      totalRequestsPerSecond += rps;

      endpoints[endpoint] = {
        ...metrics,
        requestsPerSecond: rps,
      };
    }

    return {
      timestamp: now,
      endpoints: endpoints as Record<
        EndpointId,
        EndpointMetrics & { requestsPerSecond: number }
      >,
      global: {
        totalActiveConnections,
        totalRequestsPerSecond,
        uptimeSeconds: Math.floor((now - this.startTime) / 1000),
      },
    };
  }

  /**
   * Calculate percentile from latencies
   */
  getLatencyPercentile(
    endpoint: EndpointId,
    percentile: number,
  ): number | null {
    const metrics = this.metrics.get(endpoint);
    if (!metrics || metrics.latencies.length === 0) return null;

    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.initializeMetrics();
    this.activeRequests.clear();
    this.startTime = Date.now();
    this.emit("metrics", this.getSnapshot());
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

// Helper to generate request IDs
let requestCounter = 0;
export function generateRequestId(): string {
  return `req_${Date.now()}_${++requestCounter}`;
}
