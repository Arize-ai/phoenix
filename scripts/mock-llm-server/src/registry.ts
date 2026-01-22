import { EventEmitter } from "events";
import type { Provider, EndpointId } from "./providers/types.js";
import type { RateLimiter, RateLimitConfig } from "./rate-limiting/types.js";
import {
  createRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
} from "./rate-limiting/index.js";

/**
 * Sanitize an object to prevent prototype pollution attacks.
 * Removes dangerous keys like __proto__, constructor, prototype.
 */
function sanitizeObject<T extends object>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  const dangerous = ["__proto__", "constructor", "prototype"];
  const sanitized = { ...obj } as T & Record<string, unknown>;

  for (const key of dangerous) {
    if (key in sanitized) {
      delete sanitized[key];
    }
  }

  return sanitized as T;
}

/**
 * Error types for injection
 */
export type ErrorType =
  | "timeout"
  | "server_error"
  | "bad_request"
  | "authentication_error"
  | "permission_denied"
  | "slow_response"
  | "connection_reset";

/**
 * Per-endpoint configuration
 */
export interface EndpointConfig {
  // Streaming configuration
  streamInitialDelayMs: number;
  streamDelayMs: number;
  streamJitterMs: number;
  streamChunkSize: number;

  // Tool calls
  toolCallProbability: number;

  // Error injection
  errorRate: number;
  errorTypes: ErrorType[];

  // Advanced failure modes
  streamInterruptRate: number; // Probability of interrupting a stream mid-response
  loadDegradationEnabled: boolean; // Enable latency increase under load
  loadDegradationFactor: number; // Max multiplier for latency (e.g., 3.0 = 3x slower at peak)

  // Endpoint state
  enabled: boolean;

  // Rate limiting
  rateLimit: RateLimitConfig;
}

/**
 * Global configuration (defaults for all endpoints)
 */
export interface GlobalConfig extends EndpointConfig {
  defaultResponse: string;
  getDefaultResponse: () => string;
}

/**
 * Full dynamic configuration
 */
export interface DynamicConfig {
  global: GlobalConfig;
  endpoints: Partial<Record<EndpointId, Partial<EndpointConfig>>>;
}

/**
 * Default global configuration
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  streamInitialDelayMs: 300,
  streamDelayMs: 50,
  streamJitterMs: 30,
  streamChunkSize: 10,
  toolCallProbability: 0.75,
  errorRate: 0,
  errorTypes: ["server_error"],
  streamInterruptRate: 0,
  loadDegradationEnabled: false,
  loadDegradationFactor: 2.0,
  enabled: true,
  rateLimit: DEFAULT_RATE_LIMIT_CONFIG,
  defaultResponse: "This is a mock response from the server.",
  getDefaultResponse: () => "This is a mock response from the server.",
};

/**
 * Endpoint Registry
 *
 * Manages providers and their per-endpoint rate limiters.
 * Handles configuration updates and rate limiter lifecycle.
 */
class EndpointRegistry extends EventEmitter {
  private providers: Map<EndpointId, Provider> = new Map();
  private rateLimiters: Map<EndpointId, RateLimiter> = new Map();
  private config: DynamicConfig;
  private initialConfig: GlobalConfig | null = null; // Store initial env config for reset

  constructor() {
    super();
    this.config = {
      global: { ...DEFAULT_GLOBAL_CONFIG },
      endpoints: {},
    };
  }

  /**
   * Register a provider
   */
  registerProvider(provider: Provider): void {
    this.providers.set(provider.id, provider);
    // Create rate limiter for this endpoint
    const config = this.getEndpointConfig(provider.id);
    this.rateLimiters.set(provider.id, createRateLimiter(config.rateLimit));
  }

  /**
   * Get a provider by endpoint ID
   */
  getProvider(endpointId: EndpointId): Provider | undefined {
    return this.providers.get(endpointId);
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Provider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get rate limiter for an endpoint
   */
  getRateLimiter(endpointId: EndpointId): RateLimiter {
    let limiter = this.rateLimiters.get(endpointId);
    if (!limiter) {
      const config = this.getEndpointConfig(endpointId);
      limiter = createRateLimiter(config.rateLimit);
      this.rateLimiters.set(endpointId, limiter);
    }
    return limiter;
  }

  /**
   * Get effective config for an endpoint (global merged with overrides)
   */
  getEndpointConfig(endpointId: EndpointId): EndpointConfig {
    const overrides = this.config.endpoints[endpointId] || {};
    const merged: EndpointConfig = {
      streamInitialDelayMs:
        overrides.streamInitialDelayMs ??
        this.config.global.streamInitialDelayMs,
      streamDelayMs:
        overrides.streamDelayMs ?? this.config.global.streamDelayMs,
      streamJitterMs:
        overrides.streamJitterMs ?? this.config.global.streamJitterMs,
      streamChunkSize:
        overrides.streamChunkSize ?? this.config.global.streamChunkSize,
      toolCallProbability:
        overrides.toolCallProbability ?? this.config.global.toolCallProbability,
      errorRate: overrides.errorRate ?? this.config.global.errorRate,
      errorTypes: overrides.errorTypes ?? this.config.global.errorTypes,
      streamInterruptRate:
        overrides.streamInterruptRate ?? this.config.global.streamInterruptRate,
      loadDegradationEnabled:
        overrides.loadDegradationEnabled ??
        this.config.global.loadDegradationEnabled,
      loadDegradationFactor:
        overrides.loadDegradationFactor ??
        this.config.global.loadDegradationFactor,
      enabled: overrides.enabled ?? this.config.global.enabled,
      rateLimit: overrides.rateLimit
        ? { ...this.config.global.rateLimit, ...overrides.rateLimit }
        : this.config.global.rateLimit,
    };
    return merged;
  }

  /**
   * Get global config
   */
  getGlobalConfig(): GlobalConfig {
    return { ...this.config.global };
  }

  /**
   * Get full config (for API/dashboard)
   */
  getFullConfig(): DynamicConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Update global config
   */
  updateGlobalConfig(updates: Partial<GlobalConfig>): void {
    // Sanitize input to prevent prototype pollution
    const sanitizedUpdates = sanitizeObject(updates);

    // Handle nested rateLimit updates
    if (sanitizedUpdates.rateLimit) {
      this.config.global.rateLimit = {
        ...this.config.global.rateLimit,
        ...sanitizeObject(sanitizedUpdates.rateLimit),
      };
      delete sanitizedUpdates.rateLimit;
    }

    this.config.global = {
      ...this.config.global,
      ...sanitizedUpdates,
    };

    // Recreate all rate limiters with new global config
    for (const endpointId of this.providers.keys()) {
      if (!this.config.endpoints[endpointId]?.rateLimit) {
        const config = this.getEndpointConfig(endpointId);
        this.rateLimiters.set(endpointId, createRateLimiter(config.rateLimit));
      }
    }

    this.emit("config_change", this.getFullConfig());
  }

  /**
   * Update endpoint-specific config
   */
  updateEndpointConfig(
    endpointId: EndpointId,
    updates: Partial<EndpointConfig>,
  ): void {
    // Sanitize input to prevent prototype pollution
    const sanitizedUpdates = sanitizeObject(updates);
    const existing = this.config.endpoints[endpointId] || {};

    // Handle nested rateLimit updates
    if (sanitizedUpdates.rateLimit) {
      existing.rateLimit = {
        ...(existing.rateLimit || this.config.global.rateLimit),
        ...sanitizeObject(sanitizedUpdates.rateLimit),
      };
      delete sanitizedUpdates.rateLimit;
    }

    this.config.endpoints[endpointId] = {
      ...existing,
      ...sanitizedUpdates,
    };

    // Recreate rate limiter for this endpoint
    const config = this.getEndpointConfig(endpointId);
    this.rateLimiters.set(endpointId, createRateLimiter(config.rateLimit));

    this.emit("config_change", this.getFullConfig());
  }

  /**
   * Clear endpoint overrides
   */
  clearEndpointOverrides(endpointId: EndpointId): void {
    delete this.config.endpoints[endpointId];

    // Recreate rate limiter with global config
    const config = this.getEndpointConfig(endpointId);
    this.rateLimiters.set(endpointId, createRateLimiter(config.rateLimit));

    this.emit("config_change", this.getFullConfig());
  }

  /**
   * Reset all config to defaults (uses initial env config if available)
   */
  reset(): void {
    // Use initial env config if we have it, otherwise fall back to hardcoded defaults
    const baseConfig = this.initialConfig || DEFAULT_GLOBAL_CONFIG;

    this.config = {
      global: { ...baseConfig },
      endpoints: {},
    };

    // Recreate all rate limiters
    for (const endpointId of this.providers.keys()) {
      const config = this.getEndpointConfig(endpointId);
      this.rateLimiters.set(endpointId, createRateLimiter(config.rateLimit));
    }

    this.emit("config_change", this.getFullConfig());
  }

  /**
   * Reset rate limiter state for an endpoint
   */
  resetRateLimiter(endpointId: EndpointId): void {
    const limiter = this.rateLimiters.get(endpointId);
    if (limiter) {
      limiter.reset();
    }
  }

  /**
   * Reset all rate limiter states
   */
  resetAllRateLimiters(): void {
    for (const limiter of this.rateLimiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Check if error should be injected for an endpoint
   */
  shouldInjectError(endpointId: EndpointId): boolean {
    const config = this.getEndpointConfig(endpointId);
    return config.errorRate > 0 && Math.random() < config.errorRate;
  }

  /**
   * Get random error type for an endpoint
   */
  getRandomErrorType(endpointId: EndpointId): ErrorType {
    const config = this.getEndpointConfig(endpointId);
    const types =
      config.errorTypes.length > 0 ? config.errorTypes : ["server_error"];
    return types[Math.floor(Math.random() * types.length)] as ErrorType;
  }

  /**
   * Check if a stream should be interrupted mid-response
   */
  shouldInterruptStream(endpointId: EndpointId): boolean {
    const config = this.getEndpointConfig(endpointId);
    return (
      config.streamInterruptRate > 0 &&
      Math.random() < config.streamInterruptRate
    );
  }

  /**
   * Get load factor for latency degradation
   * Returns a multiplier based on current connections vs baseline
   */
  getLoadFactor(endpointId: EndpointId): number {
    const config = this.getEndpointConfig(endpointId);
    if (!config.loadDegradationEnabled) {
      return 1.0;
    }

    // Simple load factor: increases linearly with active connections
    // At 10+ concurrent connections, reaches max degradation
    const limiter = this.rateLimiters.get(endpointId);
    const state = limiter?.getState();
    const currentLoad = state?.currentCount ?? 0;
    const maxLoad = 10; // Baseline for "high load"

    const loadRatio = Math.min(1, currentLoad / maxLoad);
    return 1 + (config.loadDegradationFactor - 1) * loadRatio;
  }

  /**
   * Initialize from environment config
   */
  initFromEnv(envConfig: {
    streamInitialDelayMs: number;
    streamDelayMs: number;
    streamJitterMs: number;
    streamChunkSize: number;
    toolCallProbability: number;
    rateLimitEnabled: boolean;
    rateLimitRequests: number;
    rateLimitWindowMs: number;
    rateLimitFailureMode: string;
    rateLimitRandomProbability: number;
    rateLimitAfterN: number;
    getDefaultResponse: () => string;
  }): void {
    // Map old config format to new format
    let strategy: RateLimitConfig["strategy"] = "fixed-window";
    switch (envConfig.rateLimitFailureMode) {
      case "always":
        strategy = "always";
        break;
      case "random":
        strategy = "random";
        break;
      case "after_n":
        strategy = "after-n";
        break;
    }

    const globalConfig: GlobalConfig = {
      streamInitialDelayMs: envConfig.streamInitialDelayMs,
      streamDelayMs: envConfig.streamDelayMs,
      streamJitterMs: envConfig.streamJitterMs,
      streamChunkSize: envConfig.streamChunkSize,
      toolCallProbability: envConfig.toolCallProbability,
      errorRate: 0,
      errorTypes: ["server_error"],
      streamInterruptRate: 0,
      loadDegradationEnabled: false,
      loadDegradationFactor: 2.0,
      enabled: true,
      defaultResponse: envConfig.getDefaultResponse(),
      getDefaultResponse: envConfig.getDefaultResponse,
      rateLimit: {
        enabled: envConfig.rateLimitEnabled,
        strategy,
        maxRequests: envConfig.rateLimitRequests,
        windowMs: envConfig.rateLimitWindowMs,
        bucketCapacity: envConfig.rateLimitRequests,
        refillRate:
          envConfig.rateLimitRequests / (envConfig.rateLimitWindowMs / 1000),
        failAfterN: envConfig.rateLimitAfterN,
        failProbability: envConfig.rateLimitRandomProbability,
      },
    };

    this.config.global = globalConfig;

    // Save initial config for reset (preserves the dynamic getDefaultResponse function)
    this.initialConfig = { ...globalConfig };

    // Recreate all rate limiters
    for (const endpointId of this.providers.keys()) {
      const config = this.getEndpointConfig(endpointId);
      this.rateLimiters.set(endpointId, createRateLimiter(config.rateLimit));
    }
  }
}

// Singleton instance
export const registry = new EndpointRegistry();
