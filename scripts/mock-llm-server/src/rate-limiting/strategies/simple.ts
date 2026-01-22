import type {
  RateLimiter,
  RateLimitResult,
  RateLimitConfig,
  RateLimiterState,
} from "../types.js";

/**
 * After-N Rate Limiter
 *
 * Allows the first N requests, then rejects all subsequent requests.
 * Useful for testing "exhausted quota" scenarios.
 */
export class AfterNRateLimiter implements RateLimiter {
  private totalRequests = 0;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(): RateLimitResult {
    if (!this.config.enabled) {
      return { allowed: true, headers: {} };
    }

    this.totalRequests++;

    const headers: Record<string, string> = {
      "x-ratelimit-limit-requests": String(this.config.failAfterN),
      "x-ratelimit-remaining-requests": String(
        Math.max(0, this.config.failAfterN - this.totalRequests),
      ),
    };

    if (this.totalRequests > this.config.failAfterN) {
      return {
        allowed: false,
        retryAfter: 60, // Arbitrary - won't actually work until reset
        headers: { ...headers, "retry-after": "60", "retry-after-ms": "60000" },
      };
    }

    return { allowed: true, headers };
  }

  reset(): void {
    this.totalRequests = 0;
  }

  getState(): RateLimiterState {
    return {
      strategy: "after-n",
      currentCount: this.totalRequests,
      maxCount: this.config.failAfterN,
    };
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Random Rate Limiter
 *
 * Randomly rejects requests with a configured probability.
 * Useful for testing retry logic and error handling.
 */
export class RandomRateLimiter implements RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(): RateLimitResult {
    if (!this.config.enabled) {
      return { allowed: true, headers: {} };
    }

    const headers: Record<string, string> = {
      "x-ratelimit-probability": String(this.config.failProbability),
    };

    if (Math.random() < this.config.failProbability) {
      return {
        allowed: false,
        retryAfter: 1,
        headers: { ...headers, "retry-after": "1", "retry-after-ms": "1000" },
      };
    }

    return { allowed: true, headers };
  }

  reset(): void {
    // No state to reset
  }

  getState(): RateLimiterState {
    return {
      strategy: "random",
    };
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Always Rate Limiter
 *
 * Always rejects requests. Useful for testing rate limit error handling.
 */
export class AlwaysRateLimiter implements RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(): RateLimitResult {
    if (!this.config.enabled) {
      return { allowed: true, headers: {} };
    }

    return {
      allowed: false,
      retryAfter: 60,
      headers: {
        "x-ratelimit-limit-requests": "0",
        "x-ratelimit-remaining-requests": "0",
        "retry-after": "60",
        "retry-after-ms": "60000",
      },
    };
  }

  reset(): void {
    // No state to reset
  }

  getState(): RateLimiterState {
    return {
      strategy: "always",
    };
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * No-op Rate Limiter
 *
 * Never rate limits. Used when rate limiting is disabled.
 */
export class NoOpRateLimiter implements RateLimiter {
  check(): RateLimitResult {
    return { allowed: true, headers: {} };
  }

  reset(): void {}

  getState(): RateLimiterState {
    return { strategy: "none" };
  }

  updateConfig(): void {}
}
