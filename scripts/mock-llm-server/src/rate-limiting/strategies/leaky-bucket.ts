import type { RateLimiter, RateLimitResult, RateLimitConfig, RateLimiterState } from "../types.js";

/**
 * Leaky Bucket Rate Limiter
 *
 * Requests enter a queue that "leaks" at a constant rate.
 * If the queue is full, requests are rejected.
 * Provides very smooth, consistent output rate.
 */
export class LeakyBucketRateLimiter implements RateLimiter {
  private queue: number[] = []; // timestamps of queued requests
  private lastLeak: number;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.lastLeak = Date.now();
  }

  private leak(): void {
    const now = Date.now();
    const elapsed = (now - this.lastLeak) / 1000; // seconds
    const leakCount = Math.floor(elapsed * this.config.refillRate);

    if (leakCount > 0) {
      // Remove leaked requests from queue
      this.queue = this.queue.slice(leakCount);
      this.lastLeak = now;
    }
  }

  check(): RateLimitResult {
    if (!this.config.enabled) {
      return { allowed: true, headers: {} };
    }

    this.leak();

    const queueSpace = this.config.bucketCapacity - this.queue.length;

    const headers: Record<string, string> = {
      "x-ratelimit-limit-requests": String(this.config.bucketCapacity),
      "x-ratelimit-remaining-requests": String(queueSpace),
    };

    if (this.queue.length >= this.config.bucketCapacity) {
      // Queue is full, calculate when space will be available
      const timeToNextSlotSeconds = 1 / this.config.refillRate;
      const timeToNextSlotMs = Math.ceil(timeToNextSlotSeconds * 1000);

      return {
        allowed: false,
        retryAfter: Math.ceil(timeToNextSlotSeconds),
        headers: {
          ...headers,
          "retry-after": String(Math.ceil(timeToNextSlotSeconds)),
          "retry-after-ms": String(timeToNextSlotMs),
        },
      };
    }

    // Add request to queue
    this.queue.push(Date.now());

    return { allowed: true, headers };
  }

  reset(): void {
    this.queue = [];
    this.lastLeak = Date.now();
  }

  getState(): RateLimiterState {
    this.leak(); // Update before reporting
    return {
      strategy: "leaky-bucket",
      queueLength: this.queue.length,
      capacity: this.config.bucketCapacity,
    };
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
