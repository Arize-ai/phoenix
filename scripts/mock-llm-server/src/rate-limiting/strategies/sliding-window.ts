import type { RateLimiter, RateLimitResult, RateLimitConfig, RateLimiterState } from "../types.js";

/**
 * Sliding Window Rate Limiter
 *
 * Tracks individual request timestamps and counts requests in a sliding window.
 * More accurate than fixed window but uses more memory.
 */
export class SlidingWindowRateLimiter implements RateLimiter {
  private timestamps: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(): RateLimitResult {
    if (!this.config.enabled) {
      return { allowed: true, headers: {} };
    }

    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Remove expired timestamps
    this.timestamps = this.timestamps.filter((t) => t > windowStart);

    const currentCount = this.timestamps.length;
    const remaining = Math.max(0, this.config.maxRequests - currentCount - 1);

    // Calculate when the oldest request will expire
    const oldestTimestamp = this.timestamps[0];
    const resetInSeconds = oldestTimestamp
      ? Math.ceil((oldestTimestamp + this.config.windowMs - now) / 1000)
      : Math.ceil(this.config.windowMs / 1000);

    const headers: Record<string, string> = {
      "x-ratelimit-limit-requests": String(this.config.maxRequests),
      "x-ratelimit-remaining-requests": String(Math.max(0, remaining)),
      "x-ratelimit-reset-requests": `${resetInSeconds}s`,
    };

    if (currentCount >= this.config.maxRequests) {
      const resetInMs = oldestTimestamp
        ? oldestTimestamp + this.config.windowMs - now
        : this.config.windowMs;
      return {
        allowed: false,
        retryAfter: resetInSeconds,
        headers: {
          ...headers,
          "retry-after": String(resetInSeconds),
          "retry-after-ms": String(Math.max(0, resetInMs)),
        },
      };
    }

    // Record this request
    this.timestamps.push(now);

    return { allowed: true, headers };
  }

  reset(): void {
    this.timestamps = [];
  }

  getState(): RateLimiterState {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const activeCount = this.timestamps.filter((t) => t > windowStart).length;

    return {
      strategy: "sliding-window",
      currentCount: activeCount,
      maxCount: this.config.maxRequests,
      windowStartMs: windowStart,
    };
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
