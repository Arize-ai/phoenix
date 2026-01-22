import type {
  RateLimiter,
  RateLimitResult,
  RateLimitConfig,
  RateLimiterState,
} from "../types.js";

/**
 * Fixed Window Rate Limiter
 *
 * Allows N requests per fixed time window. Window resets completely when it expires.
 * Simple but can allow 2x burst at window boundaries.
 */
export class FixedWindowRateLimiter implements RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(): RateLimitResult {
    if (!this.config.enabled) {
      return { allowed: true, headers: {} };
    }

    const now = Date.now();

    // Reset window if expired
    if (now - this.windowStart >= this.config.windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    this.requestCount++;
    const remaining = Math.max(0, this.config.maxRequests - this.requestCount);
    const resetInSeconds = Math.ceil(
      (this.config.windowMs - (now - this.windowStart)) / 1000,
    );

    const headers: Record<string, string> = {
      "x-ratelimit-limit-requests": String(this.config.maxRequests),
      "x-ratelimit-remaining-requests": String(remaining),
      "x-ratelimit-reset-requests": `${resetInSeconds}s`,
    };

    if (this.requestCount > this.config.maxRequests) {
      const resetInMs = this.config.windowMs - (now - this.windowStart);
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

    return { allowed: true, headers };
  }

  reset(): void {
    this.requestCount = 0;
    this.windowStart = Date.now();
  }

  getState(): RateLimiterState {
    return {
      strategy: "fixed-window",
      currentCount: this.requestCount,
      maxCount: this.config.maxRequests,
      windowStartMs: this.windowStart,
    };
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    // Reset if window size changed
    if (config.windowMs !== undefined) {
      this.reset();
    }
  }
}
