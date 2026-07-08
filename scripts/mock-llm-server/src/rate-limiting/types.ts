/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until retry is allowed
  headers: Record<string, string>;
}

/**
 * Configuration for rate limiters
 */
export interface RateLimitConfig {
  enabled: boolean;
  strategy: RateLimitStrategy;

  // Fixed/Sliding window config
  maxRequests: number;
  windowMs: number;

  // Token bucket config
  bucketCapacity: number;
  refillRate: number; // tokens per second

  // After-N config
  failAfterN: number;

  // Random config
  failProbability: number;
}

/**
 * Available rate limiting strategies
 */
export type RateLimitStrategy =
  | "none"
  | "fixed-window"
  | "sliding-window"
  | "token-bucket"
  | "leaky-bucket"
  | "after-n"
  | "random"
  | "always";

/**
 * Rate limiter interface - implemented by each strategy
 */
export interface RateLimiter {
  /**
   * Check if a request should be allowed
   */
  check(): RateLimitResult;

  /**
   * Reset the rate limiter state
   */
  reset(): void;

  /**
   * Get current state for debugging/dashboard
   */
  getState(): RateLimiterState;

  /**
   * Update configuration (may reset state)
   */
  updateConfig(config: Partial<RateLimitConfig>): void;
}

/**
 * State info for dashboard display
 */
export interface RateLimiterState {
  strategy: RateLimitStrategy;
  currentCount?: number;
  maxCount?: number;
  windowStartMs?: number;
  tokens?: number;
  capacity?: number;
  queueLength?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  enabled: false,
  strategy: "fixed-window",
  maxRequests: 100,
  windowMs: 60000,
  bucketCapacity: 10,
  refillRate: 1,
  failAfterN: 5,
  failProbability: 0.3,
};
