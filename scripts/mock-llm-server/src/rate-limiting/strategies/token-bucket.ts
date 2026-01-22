import type { RateLimiter, RateLimitResult, RateLimitConfig, RateLimiterState } from "../types.js";

/**
 * Token Bucket Rate Limiter
 *
 * Maintains a bucket of tokens that refills at a constant rate.
 * Allows bursts up to bucket capacity while maintaining average rate.
 * Good for APIs where occasional bursts are acceptable.
 */
export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.bucketCapacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.config.refillRate;

    this.tokens = Math.min(this.config.bucketCapacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  check(): RateLimitResult {
    if (!this.config.enabled) {
      return { allowed: true, headers: {} };
    }

    this.refill();

    const headers: Record<string, string> = {
      "x-ratelimit-limit-requests": String(this.config.bucketCapacity),
      "x-ratelimit-remaining-requests": String(Math.floor(this.tokens)),
    };

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { allowed: true, headers };
    }

    // Calculate time until next token
    const timeToNextTokenSeconds = (1 - this.tokens) / this.config.refillRate;
    const timeToNextTokenMs = Math.ceil(timeToNextTokenSeconds * 1000);

    return {
      allowed: false,
      retryAfter: Math.ceil(timeToNextTokenSeconds),
      headers: {
        ...headers,
        "retry-after": String(Math.ceil(timeToNextTokenSeconds)),
        "retry-after-ms": String(timeToNextTokenMs),
      },
    };
  }

  reset(): void {
    this.tokens = this.config.bucketCapacity;
    this.lastRefill = Date.now();
  }

  getState(): RateLimiterState {
    this.refill(); // Update token count before reporting
    return {
      strategy: "token-bucket",
      tokens: Math.floor(this.tokens),
      capacity: this.config.bucketCapacity,
    };
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    const oldCapacity = this.config.bucketCapacity;
    this.config = { ...this.config, ...config };

    // If capacity increased, allow immediate use of new tokens
    if (config.bucketCapacity !== undefined && config.bucketCapacity > oldCapacity) {
      this.tokens = Math.min(config.bucketCapacity, this.tokens + (config.bucketCapacity - oldCapacity));
    }
  }
}
