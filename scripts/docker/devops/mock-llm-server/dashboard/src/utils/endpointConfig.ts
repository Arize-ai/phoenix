import type { DynamicConfig, EndpointConfig, EndpointId } from "../types";

/** Same per-field fallback as the server's getEndpointConfig. */
export function effectiveEndpointConfig(
  config: DynamicConfig,
  endpointId: EndpointId
): EndpointConfig {
  const overrides = config.endpoints[endpointId] ?? {};
  const global = config.global;
  return {
    responseDelayMs: overrides.responseDelayMs ?? global.responseDelayMs ?? 0,
    streamInitialDelayMs:
      overrides.streamInitialDelayMs ?? global.streamInitialDelayMs,
    streamDelayMs: overrides.streamDelayMs ?? global.streamDelayMs,
    streamJitterMs: overrides.streamJitterMs ?? global.streamJitterMs,
    streamChunkSize: overrides.streamChunkSize ?? global.streamChunkSize,
    toolCallProbability:
      overrides.toolCallProbability ?? global.toolCallProbability,
    errorRate: overrides.errorRate ?? global.errorRate,
    errorTypes: overrides.errorTypes ?? global.errorTypes,
    streamInterruptRate:
      overrides.streamInterruptRate ?? global.streamInterruptRate,
    loadDegradationEnabled:
      overrides.loadDegradationEnabled ?? global.loadDegradationEnabled,
    loadDegradationFactor:
      overrides.loadDegradationFactor ?? global.loadDegradationFactor,
    enabled: overrides.enabled ?? global.enabled,
    rateLimit: overrides.rateLimit
      ? { ...global.rateLimit, ...overrides.rateLimit }
      : global.rateLimit,
  };
}
