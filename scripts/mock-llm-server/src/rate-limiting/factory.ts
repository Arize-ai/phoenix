import type { RateLimiter, RateLimitConfig, RateLimitStrategy } from "./types.js";
import { FixedWindowRateLimiter } from "./strategies/fixed-window.js";
import { SlidingWindowRateLimiter } from "./strategies/sliding-window.js";
import { TokenBucketRateLimiter } from "./strategies/token-bucket.js";
import { LeakyBucketRateLimiter } from "./strategies/leaky-bucket.js";
import {
  AfterNRateLimiter,
  RandomRateLimiter,
  AlwaysRateLimiter,
  NoOpRateLimiter,
} from "./strategies/simple.js";

/**
 * Factory to create rate limiters based on strategy name
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  if (!config.enabled) {
    return new NoOpRateLimiter();
  }

  switch (config.strategy) {
    case "none":
      return new NoOpRateLimiter();

    case "fixed-window":
      return new FixedWindowRateLimiter(config);

    case "sliding-window":
      return new SlidingWindowRateLimiter(config);

    case "token-bucket":
      return new TokenBucketRateLimiter(config);

    case "leaky-bucket":
      return new LeakyBucketRateLimiter(config);

    case "after-n":
      return new AfterNRateLimiter(config);

    case "random":
      return new RandomRateLimiter(config);

    case "always":
      return new AlwaysRateLimiter(config);

    default:
      console.warn(`Unknown rate limit strategy: ${config.strategy}, falling back to fixed-window`);
      return new FixedWindowRateLimiter(config);
  }
}

/**
 * Get human-readable description of a strategy
 */
export function getStrategyDescription(strategy: RateLimitStrategy): string {
  const descriptions: Record<RateLimitStrategy, string> = {
    none: "Disabled - no rate limiting",
    "fixed-window": "Fixed Window - N requests per time window",
    "sliding-window": "Sliding Window - N requests in rolling window",
    "token-bucket": "Token Bucket - burst-friendly with steady refill",
    "leaky-bucket": "Leaky Bucket - smooth constant rate output",
    "after-n": "After N - fail after N total requests",
    random: "Random - fail with probability P",
    always: "Always - reject all requests",
  };
  return descriptions[strategy] || strategy;
}

/**
 * Get all available strategies
 */
export function getAvailableStrategies(): RateLimitStrategy[] {
  return [
    "none",
    "fixed-window",
    "sliding-window",
    "token-bucket",
    "leaky-bucket",
    "after-n",
    "random",
    "always",
  ];
}
