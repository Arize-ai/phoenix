// Types shared between dashboard and server

export type EndpointId =
  | "openai-chat"
  | "openai-responses"
  | "anthropic-messages"
  | "gemini-generate"
  | "gemini-stream"
  | "gemini-generate-v1"
  | "gemini-stream-v1";

export const ENDPOINT_LABELS: Record<EndpointId, string> = {
  "openai-chat": "OpenAI Chat",
  "openai-responses": "OpenAI Responses",
  "anthropic-messages": "Anthropic",
  "gemini-generate": "Gemini (v1beta)",
  "gemini-stream": "Gemini Stream (v1beta)",
  "gemini-generate-v1": "Gemini (v1)",
  "gemini-stream-v1": "Gemini Stream (v1)",
};

// Basic metrics (original)
export interface EndpointMetrics {
  activeConnections: number;
  activeStreamingConnections: number;
  totalRequests: number;
  totalErrors: number;
  totalRateLimited: number;
  latencies: number[];
  requestTimestamps: number[];
  requestsPerSecond: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  endpoints: Record<EndpointId, EndpointMetrics>;
  global: {
    totalActiveConnections: number;
    totalRequestsPerSecond: number;
    uptimeSeconds: number;
  };
}

// Detailed metrics
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

export interface LatencyBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface ErrorEntry {
  type: string;
  count: number;
  lastOccurred: number;
}

export interface DetailedMetricsSnapshot {
  timestamp: number;
  endpoints: Record<EndpointId, {
    timeSeries: TimeSeriesPoint[];
    peaks: PeakMetrics;
    latencyHistogram: LatencyBucket[];
    errors: ErrorEntry[];
    currentRPS: number;
    currentConnections: number;
    totalStreaming: number;
    totalNonStreaming: number;
  }>;
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

export interface ConnectionEvent {
  type: "connection_open" | "connection_close" | "request_start" | "request_end" | "error" | "rate_limited";
  endpoint: EndpointId;
  timestamp: number;
  requestId?: string;
  error?: string;
  latencyMs?: number;
  streaming?: boolean;
}

// Rate limiting types
export type RateLimitStrategy =
  | "none"
  | "fixed-window"
  | "sliding-window"
  | "token-bucket"
  | "leaky-bucket"
  | "after-n"
  | "random"
  | "always";

export interface RateLimitConfig {
  enabled: boolean;
  strategy: RateLimitStrategy;
  maxRequests: number;
  windowMs: number;
  bucketCapacity: number;
  refillRate: number;
  failAfterN: number;
  failProbability: number;
}

// Error/failure types
export type ErrorType = 
  | "timeout" 
  | "server_error" 
  | "bad_request"
  | "slow_response"
  | "connection_reset";

export interface EndpointConfig {
  streamInitialDelayMs: number;
  streamDelayMs: number;
  streamJitterMs: number;
  streamChunkSize: number;
  toolCallProbability: number;
  errorRate: number;
  errorTypes: ErrorType[];
  streamInterruptRate: number;
  loadDegradationEnabled: boolean;
  loadDegradationFactor: number;
  enabled: boolean;
  rateLimit: RateLimitConfig;
}

export interface GlobalConfig extends EndpointConfig {
  defaultResponse: string;
}

export interface DynamicConfig {
  global: GlobalConfig;
  endpoints: Partial<Record<EndpointId, Partial<EndpointConfig>>>;
}

export interface WebSocketMessage {
  type: "metrics" | "detailed_metrics" | "event" | "config" | "error";
  data: unknown;
}

export const RATE_LIMIT_STRATEGIES: { id: RateLimitStrategy; label: string; description: string }[] = [
  { id: "none", label: "Disabled", description: "No rate limiting" },
  { id: "fixed-window", label: "Fixed Window", description: "N requests per time window" },
  { id: "sliding-window", label: "Sliding Window", description: "N requests in rolling window" },
  { id: "token-bucket", label: "Token Bucket", description: "Burst-friendly with steady refill" },
  { id: "leaky-bucket", label: "Leaky Bucket", description: "Smooth constant rate output" },
  { id: "after-n", label: "After N", description: "Fail after N total requests" },
  { id: "random", label: "Random", description: "Fail with probability P" },
  { id: "always", label: "Always", description: "Reject all requests" },
];

export const ERROR_TYPES: { id: ErrorType; label: string; description: string }[] = [
  { id: "server_error", label: "Server Error (500)", description: "Returns HTTP 500" },
  { id: "bad_request", label: "Bad Request (400)", description: "Returns HTTP 400" },
  { id: "timeout", label: "Timeout", description: "Request hangs indefinitely" },
  { id: "slow_response", label: "Slow Response", description: "5-10 second delay" },
  { id: "connection_reset", label: "Connection Reset", description: "Abruptly closes connection" },
];
