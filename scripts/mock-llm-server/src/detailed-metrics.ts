import { EventEmitter } from "events";
import type { EndpointId } from "./providers/types.js";
import { ENDPOINT_IDS } from "./providers/types.js";

/**
 * Time-series data point (1 second resolution)
 */
export interface TimeSeriesPoint {
  timestamp: number;
  activeConnections: number;
  cumulativeConnections: number;
  requestsStarted: number;
  requestsCompleted: number;
  requestsFailed: number;
  requestsRateLimited: number;
  avgLatencyMs: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
}

/**
 * Peak/watermark tracking
 */
export interface PeakMetrics {
  maxConcurrentConnections: number;
  maxConcurrentAt: number;
  maxRPS: number;
  maxRPSAt: number;
  maxLatencyMs: number;
  maxLatencyAt: number;
  totalRequests: number;
  totalConnections: number;
  totalErrors: number;
  totalRateLimited: number;
  startTime: number;
}

/**
 * Latency histogram bucket
 */
export interface LatencyBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

/**
 * Error breakdown entry
 */
export interface ErrorEntry {
  type: string;
  count: number;
  lastOccurred: number;
}

/**
 * Per-endpoint detailed metrics
 */
export interface EndpointDetailedMetrics {
  timeSeries: TimeSeriesPoint[];
  peaks: PeakMetrics;
  latencyHistogram: LatencyBucket[];
  errors: Map<string, ErrorEntry>;
  // Streaming vs non-streaming totals
  totalStreaming: number;
  totalNonStreaming: number;
  // Current second accumulator
  currentSecond: {
    timestamp: number;
    requestsStarted: number;
    requestsCompleted: number;
    requestsFailed: number;
    requestsRateLimited: number;
    latencies: number[];
  };
}

/**
 * Full detailed metrics snapshot
 */
export interface DetailedMetricsSnapshot {
  timestamp: number;
  endpoints: Record<
    EndpointId,
    {
      timeSeries: TimeSeriesPoint[];
      peaks: PeakMetrics;
      latencyHistogram: LatencyBucket[];
      errors: ErrorEntry[];
      currentRPS: number;
      currentConnections: number;
      totalStreaming: number;
      totalNonStreaming: number;
    }
  >;
  global: {
    timeSeries: TimeSeriesPoint[];
    peaks: PeakMetrics;
    latencyHistogram: LatencyBucket[];
    totalErrors: ErrorEntry[];
    currentRPS: number;
    currentConnections: number;
    testDurationSeconds: number;
    totalStreaming: number;
    totalNonStreaming: number;
  };
}

// Latency histogram bucket definitions
const LATENCY_BUCKETS = [
  { label: "0-10ms", min: 0, max: 10 },
  { label: "10-25ms", min: 10, max: 25 },
  { label: "25-50ms", min: 25, max: 50 },
  { label: "50-100ms", min: 50, max: 100 },
  { label: "100-250ms", min: 100, max: 250 },
  { label: "250-500ms", min: 250, max: 500 },
  { label: "500ms-1s", min: 500, max: 1000 },
  { label: "1-2s", min: 1000, max: 2000 },
  { label: "2-5s", min: 2000, max: 5000 },
  { label: "5s+", min: 5000, max: Infinity },
];

const TIME_SERIES_MAX_POINTS = 3600; // 60 minutes at 1-second resolution
const MAX_ERROR_TYPES = 100; // Limit error type tracking to prevent memory leak

/**
 * Detailed Metrics Collector
 *
 * Provides time-series data, peak tracking, and latency histograms
 * for performance analysis.
 */
class DetailedMetricsCollector extends EventEmitter {
  private metrics: Map<EndpointId, EndpointDetailedMetrics> = new Map();
  private globalMetrics: EndpointDetailedMetrics;
  private activeConnections: Map<EndpointId, number> = new Map();
  private activeRequests: Map<
    string,
    { endpoint: EndpointId; startTime: number; streaming: boolean }
  > = new Map();
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.globalMetrics = this.createEmptyMetrics();
    this.initializeMetrics();
    this.startFlushInterval();
  }

  private createEmptyMetrics(): EndpointDetailedMetrics {
    return {
      timeSeries: [],
      peaks: {
        maxConcurrentConnections: 0,
        maxConcurrentAt: 0,
        maxRPS: 0,
        maxRPSAt: 0,
        maxLatencyMs: 0,
        maxLatencyAt: 0,
        totalRequests: 0,
        totalConnections: 0,
        totalErrors: 0,
        totalRateLimited: 0,
        startTime: Date.now(),
      },
      latencyHistogram: LATENCY_BUCKETS.map((b) => ({ ...b, count: 0 })),
      errors: new Map(),
      totalStreaming: 0,
      totalNonStreaming: 0,
      currentSecond: {
        timestamp: Math.floor(Date.now() / 1000) * 1000,
        requestsStarted: 0,
        requestsCompleted: 0,
        requestsFailed: 0,
        requestsRateLimited: 0,
        latencies: [],
      },
    };
  }

  private initializeMetrics(): void {
    for (const endpoint of ENDPOINT_IDS) {
      this.metrics.set(endpoint, this.createEmptyMetrics());
      this.activeConnections.set(endpoint, 0);
    }
  }

  private startFlushInterval(): void {
    // Flush accumulated metrics every second
    this.flushInterval = setInterval(() => this.flushCurrentSecond(), 1000);
  }

  private flushCurrentSecond(): void {
    const now = Date.now();
    const currentSecondTimestamp = Math.floor(now / 1000) * 1000;

    // Flush each endpoint
    for (const [endpointId, metrics] of this.metrics) {
      if (metrics.currentSecond.timestamp < currentSecondTimestamp) {
        this.addTimeSeriesPoint(metrics, endpointId);
        metrics.currentSecond = {
          timestamp: currentSecondTimestamp,
          requestsStarted: 0,
          requestsCompleted: 0,
          requestsFailed: 0,
          requestsRateLimited: 0,
          latencies: [],
        };
      }
    }

    // Flush global
    if (this.globalMetrics.currentSecond.timestamp < currentSecondTimestamp) {
      this.addTimeSeriesPoint(this.globalMetrics, null);
      this.globalMetrics.currentSecond = {
        timestamp: currentSecondTimestamp,
        requestsStarted: 0,
        requestsCompleted: 0,
        requestsFailed: 0,
        requestsRateLimited: 0,
        latencies: [],
      };
    }

    this.emit("tick", this.getSnapshot());
  }

  private addTimeSeriesPoint(
    metrics: EndpointDetailedMetrics,
    endpointId: EndpointId | null,
  ): void {
    const { currentSecond } = metrics;
    const latencies = currentSecond.latencies;

    const connections = endpointId
      ? this.activeConnections.get(endpointId) || 0
      : Array.from(this.activeConnections.values()).reduce((a, b) => a + b, 0);

    const point: TimeSeriesPoint = {
      timestamp: currentSecond.timestamp,
      activeConnections: connections,
      cumulativeConnections: metrics.peaks.totalConnections,
      requestsStarted: currentSecond.requestsStarted,
      requestsCompleted: currentSecond.requestsCompleted,
      requestsFailed: currentSecond.requestsFailed,
      requestsRateLimited: currentSecond.requestsRateLimited,
      avgLatencyMs:
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
      p50LatencyMs: this.percentile(latencies, 50),
      p95LatencyMs: this.percentile(latencies, 95),
      p99LatencyMs: this.percentile(latencies, 99),
    };

    metrics.timeSeries.push(point);

    // Keep only last N points
    if (metrics.timeSeries.length > TIME_SERIES_MAX_POINTS) {
      metrics.timeSeries.shift();
    }

    // Update peaks
    const rps = currentSecond.requestsCompleted + currentSecond.requestsFailed;
    if (rps > metrics.peaks.maxRPS) {
      metrics.peaks.maxRPS = rps;
      metrics.peaks.maxRPSAt = currentSecond.timestamp;
    }
    if (connections > metrics.peaks.maxConcurrentConnections) {
      metrics.peaks.maxConcurrentConnections = connections;
      metrics.peaks.maxConcurrentAt = currentSecond.timestamp;
    }
  }

  private percentile(arr: number[], p: number): number | null {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private updateLatencyHistogram(
    metrics: EndpointDetailedMetrics,
    latencyMs: number,
  ): void {
    for (const bucket of metrics.latencyHistogram) {
      if (latencyMs >= bucket.min && latencyMs < bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  /**
   * Record request start
   */
  requestStart(
    endpoint: EndpointId,
    requestId: string,
    streaming: boolean = false,
  ): void {
    // Guard against duplicate starts
    if (this.activeRequests.has(requestId)) {
      return;
    }

    const metrics = this.metrics.get(endpoint);
    if (!metrics) {
      console.warn(`Unknown endpoint: ${endpoint}`);
      return;
    }

    // Track active connection
    const current = this.activeConnections.get(endpoint) || 0;
    this.activeConnections.set(endpoint, current + 1);

    // Track request with streaming flag
    this.activeRequests.set(requestId, {
      endpoint,
      startTime: Date.now(),
      streaming,
    });

    // Update streaming/non-streaming counts
    if (streaming) {
      metrics.totalStreaming++;
      this.globalMetrics.totalStreaming++;
    } else {
      metrics.totalNonStreaming++;
      this.globalMetrics.totalNonStreaming++;
    }

    // Update current second
    metrics.currentSecond.requestsStarted++;
    metrics.peaks.totalRequests++;
    metrics.peaks.totalConnections++;

    this.globalMetrics.currentSecond.requestsStarted++;
    this.globalMetrics.peaks.totalRequests++;
    this.globalMetrics.peaks.totalConnections++;
  }

  /**
   * Record request completion
   */
  requestEnd(requestId: string): void {
    const request = this.activeRequests.get(requestId);
    if (!request) return;

    // Delete first to prevent double-counting
    this.activeRequests.delete(requestId);

    const { endpoint, startTime } = request;
    const now = Date.now();
    const latencyMs = now - startTime;
    const metrics = this.metrics.get(endpoint);
    if (!metrics) return;

    // Update connection count
    const current = this.activeConnections.get(endpoint) || 0;
    this.activeConnections.set(endpoint, Math.max(0, current - 1));

    // Record latency
    metrics.currentSecond.latencies.push(latencyMs);
    metrics.currentSecond.requestsCompleted++;

    this.globalMetrics.currentSecond.latencies.push(latencyMs);
    this.globalMetrics.currentSecond.requestsCompleted++;

    // Update histogram
    this.updateLatencyHistogram(metrics, latencyMs);
    this.updateLatencyHistogram(this.globalMetrics, latencyMs);

    // Update max latency peak
    if (latencyMs > metrics.peaks.maxLatencyMs) {
      metrics.peaks.maxLatencyMs = latencyMs;
      metrics.peaks.maxLatencyAt = now;
    }
    if (latencyMs > this.globalMetrics.peaks.maxLatencyMs) {
      this.globalMetrics.peaks.maxLatencyMs = latencyMs;
      this.globalMetrics.peaks.maxLatencyAt = now;
    }
  }

  /**
   * Record request error
   */
  requestError(requestId: string, errorType: string): void {
    const request = this.activeRequests.get(requestId);
    if (!request) return;

    // Delete first to prevent double-counting
    this.activeRequests.delete(requestId);

    const { endpoint, startTime } = request;
    const now = Date.now();
    const latencyMs = now - startTime;
    const metrics = this.metrics.get(endpoint);
    if (!metrics) return;

    // Update connection count
    const current = this.activeConnections.get(endpoint) || 0;
    this.activeConnections.set(endpoint, Math.max(0, current - 1));

    // Record error
    metrics.currentSecond.requestsFailed++;
    metrics.peaks.totalErrors++;

    // Also record latency for failed requests
    metrics.currentSecond.latencies.push(latencyMs);
    this.updateLatencyHistogram(metrics, latencyMs);

    this.globalMetrics.currentSecond.requestsFailed++;
    this.globalMetrics.peaks.totalErrors++;
    this.globalMetrics.currentSecond.latencies.push(latencyMs);
    this.updateLatencyHistogram(this.globalMetrics, latencyMs);

    // Track error type (with limit to prevent memory leak)
    this.recordErrorType(metrics.errors, errorType, now);
    this.recordErrorType(this.globalMetrics.errors, errorType, now);
  }

  /**
   * Record error type with bounded map size
   */
  private recordErrorType(
    errors: Map<string, ErrorEntry>,
    errorType: string,
    now: number,
  ): void {
    const existing = errors.get(errorType);
    if (existing) {
      existing.count++;
      existing.lastOccurred = now;
    } else if (errors.size < MAX_ERROR_TYPES) {
      errors.set(errorType, { type: errorType, count: 1, lastOccurred: now });
    } else {
      // At limit - find and replace least recent error type
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of errors) {
        if (entry.lastOccurred < oldestTime) {
          oldestTime = entry.lastOccurred;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        errors.delete(oldestKey);
        errors.set(errorType, { type: errorType, count: 1, lastOccurred: now });
      }
    }
  }

  /**
   * Record rate limit
   */
  rateLimited(endpoint: EndpointId): void {
    const metrics = this.metrics.get(endpoint);
    if (!metrics) return;

    metrics.currentSecond.requestsRateLimited++;
    metrics.peaks.totalRateLimited++;

    this.globalMetrics.currentSecond.requestsRateLimited++;
    this.globalMetrics.peaks.totalRateLimited++;
  }

  /**
   * Get current snapshot
   * Includes both flushed time series AND current second accumulator for accuracy
   */
  getSnapshot(): DetailedMetricsSnapshot {
    const now = Date.now();
    const endpoints: Record<
      string,
      DetailedMetricsSnapshot["endpoints"][EndpointId]
    > = {};

    for (const [endpointId, metrics] of this.metrics) {
      // Include current second data in RPS calculation
      const currentSecondRPS =
        metrics.currentSecond.requestsCompleted +
        metrics.currentSecond.requestsFailed;
      const recentPoints = metrics.timeSeries.slice(-4); // Last 4 completed seconds
      const historicalRPS =
        recentPoints.length > 0
          ? recentPoints.reduce(
              (sum, p) => sum + p.requestsCompleted + p.requestsFailed,
              0,
            ) / recentPoints.length
          : 0;
      // Weighted average: current second + historical
      const currentRPS =
        recentPoints.length > 0
          ? (currentSecondRPS + historicalRPS * recentPoints.length) /
            (recentPoints.length + 1)
          : currentSecondRPS;

      endpoints[endpointId] = {
        timeSeries: metrics.timeSeries,
        peaks: { ...metrics.peaks },
        latencyHistogram: metrics.latencyHistogram.map((b) => ({ ...b })),
        errors: Array.from(metrics.errors.values()),
        currentRPS: Math.round(currentRPS),
        currentConnections: this.activeConnections.get(endpointId) || 0,
        totalStreaming: metrics.totalStreaming,
        totalNonStreaming: metrics.totalNonStreaming,
      };
    }

    // Same for global metrics
    const globalCurrentSecondRPS =
      this.globalMetrics.currentSecond.requestsCompleted +
      this.globalMetrics.currentSecond.requestsFailed;
    const globalRecentPoints = this.globalMetrics.timeSeries.slice(-4);
    const globalHistoricalRPS =
      globalRecentPoints.length > 0
        ? globalRecentPoints.reduce(
            (sum, p) => sum + p.requestsCompleted + p.requestsFailed,
            0,
          ) / globalRecentPoints.length
        : 0;
    const globalCurrentRPS =
      globalRecentPoints.length > 0
        ? (globalCurrentSecondRPS +
            globalHistoricalRPS * globalRecentPoints.length) /
          (globalRecentPoints.length + 1)
        : globalCurrentSecondRPS;

    return {
      timestamp: now,
      endpoints: endpoints as Record<
        EndpointId,
        DetailedMetricsSnapshot["endpoints"][EndpointId]
      >,
      global: {
        timeSeries: this.globalMetrics.timeSeries,
        peaks: { ...this.globalMetrics.peaks },
        latencyHistogram: this.globalMetrics.latencyHistogram.map((b) => ({
          ...b,
        })),
        totalErrors: Array.from(this.globalMetrics.errors.values()),
        currentRPS: Math.round(globalCurrentRPS),
        currentConnections: Array.from(this.activeConnections.values()).reduce(
          (a, b) => a + b,
          0,
        ),
        testDurationSeconds: Math.floor(
          (now - this.globalMetrics.peaks.startTime) / 1000,
        ),
        totalStreaming: this.globalMetrics.totalStreaming,
        totalNonStreaming: this.globalMetrics.totalNonStreaming,
      },
    };
  }

  /**
   * Export metrics as JSON for analysis
   */
  exportJSON(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  /**
   * Export time series as CSV
   */
  exportCSV(): string {
    const headers = [
      "timestamp",
      "active_connections",
      "cumulative_connections",
      "requests_started",
      "requests_completed",
      "requests_failed",
      "requests_rate_limited",
      "avg_latency_ms",
      "p50_latency_ms",
      "p95_latency_ms",
      "p99_latency_ms",
    ].join(",");

    const rows = this.globalMetrics.timeSeries.map((p) =>
      [
        new Date(p.timestamp).toISOString(),
        p.activeConnections,
        p.cumulativeConnections,
        p.requestsStarted,
        p.requestsCompleted,
        p.requestsFailed,
        p.requestsRateLimited,
        p.avgLatencyMs.toFixed(2),
        p.p50LatencyMs?.toFixed(2) ?? "",
        p.p95LatencyMs?.toFixed(2) ?? "",
        p.p99LatencyMs?.toFixed(2) ?? "",
      ].join(","),
    );

    return [headers, ...rows].join("\n");
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.globalMetrics = this.createEmptyMetrics();
    this.initializeMetrics();
    this.activeRequests.clear();
    this.emit("reset");
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

// Singleton instance
export const detailedMetrics = new DetailedMetricsCollector();
