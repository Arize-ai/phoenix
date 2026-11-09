import {
  getCredentialsFromEnvironmentWithSource,
  getProjectFromEnvironment,
  getTraceExportEndpointFromEnvironment,
} from "@arizeai/phoenix-config";
import { diag } from "@opentelemetry/api";
import { getNumberFromEnv, getStringFromEnv } from "@opentelemetry/core";
import type { Sampler, SpanLimits } from "@opentelemetry/sdk-trace";
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace";

/**
 * Resolves the trace-export endpoint and credentials as source-aware groups.
 *
 * The endpoint resolves `PHOENIX_COLLECTOR_ENDPOINT` first, then the
 * OTel-standard `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and
 * `OTEL_EXPORTER_OTLP_ENDPOINT`, then `PHOENIX_ENDPOINT` — so a configuration
 * that names Phoenix once exports spans there rather than silently to
 * localhost.
 */
export function getEnvConfig() {
  return {
    credentials: getCredentialsFromEnvironmentWithSource(),
    endpoint: getTraceExportEndpointFromEnvironment(),
  };
}

/**
 * A utility function that gets the configured collector URL
 * @returns the URL traces are exported to, as configured in the environment,
 *   or `undefined` if no trace-export variable is set
 */
export function getEnvCollectorURL(): string | undefined {
  return getEnvConfig().endpoint.value;
}

/**
 * Reads the Phoenix API key from the `PHOENIX_API_KEY` environment variable.
 *
 * @returns The API key if the environment variable is set, otherwise `undefined`.
 */
export function getEnvApiKey(): string | undefined {
  return getEnvConfig().credentials.apiKey;
}

/**
 * Reads the Phoenix project name from the environment.
 *
 * Delegates to `@arizeai/phoenix-config` so the `PHOENIX_PROJECT` (canonical) /
 * `PHOENIX_PROJECT_NAME` (alias) resolution — including precedence and the
 * one-time conflict warning — lives in a single shared implementation.
 *
 * @returns The resolved project name, or `undefined` if neither variable is set.
 */
export function getEnvProjectName(): string | undefined {
  return getProjectFromEnvironment();
}

const DEFAULT_TRACES_SAMPLER = "parentbased_always_on";

function getEnvSamplerRatio(): number {
  const ratio = getNumberFromEnv("OTEL_TRACES_SAMPLER_ARG");
  if (ratio == null || ratio < 0 || ratio > 1) {
    diag.error(
      `OTEL_TRACES_SAMPLER_ARG=${ratio ?? ""} is blank or outside [0..1], defaulting to 1.`
    );
    return 1;
  }
  return ratio;
}

/**
 * Builds the sampler named by `OTEL_TRACES_SAMPLER` (and
 * `OTEL_TRACES_SAMPLER_ARG`), or `undefined` to use the SDK default.
 */
export function getEnvSampler(): Sampler | undefined {
  const sampler = getStringFromEnv("OTEL_TRACES_SAMPLER");
  switch (sampler) {
    case undefined:
    case DEFAULT_TRACES_SAMPLER:
      return undefined;
    case "always_on":
      return new AlwaysOnSampler();
    case "always_off":
      return new AlwaysOffSampler();
    case "parentbased_always_off":
      return new ParentBasedSampler({ root: new AlwaysOffSampler() });
    case "traceidratio":
      return new TraceIdRatioBasedSampler(getEnvSamplerRatio());
    case "parentbased_traceidratio":
      return new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(getEnvSamplerRatio()),
      });
    default:
      diag.error(
        `OTEL_TRACES_SAMPLER value "${sampler}" invalid, defaulting to "${DEFAULT_TRACES_SAMPLER}".`
      );
      return undefined;
  }
}

/**
 * Reads span limits from the `OTEL_SPAN_*` and `OTEL_ATTRIBUTE_*`
 * environment variables. Unset limits keep the SDK defaults.
 */
export function getEnvSpanLimits(): SpanLimits {
  return {
    attributeCountLimit:
      getNumberFromEnv("OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT") ??
      getNumberFromEnv("OTEL_ATTRIBUTE_COUNT_LIMIT"),
    attributeValueLengthLimit:
      getNumberFromEnv("OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT") ??
      getNumberFromEnv("OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT"),
    eventCountLimit: getNumberFromEnv("OTEL_SPAN_EVENT_COUNT_LIMIT"),
    linkCountLimit: getNumberFromEnv("OTEL_SPAN_LINK_COUNT_LIMIT"),
    attributePerEventCountLimit: getNumberFromEnv(
      "OTEL_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT"
    ),
    attributePerLinkCountLimit: getNumberFromEnv(
      "OTEL_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT"
    ),
  };
}

/**
 * Reads `OTEL_BSP_*` batch span processor settings. Unset values keep the
 * SDK defaults.
 */
export function getEnvBatchSpanProcessorConfig() {
  return {
    maxExportBatchSize: getNumberFromEnv("OTEL_BSP_MAX_EXPORT_BATCH_SIZE"),
    maxQueueSize: getNumberFromEnv("OTEL_BSP_MAX_QUEUE_SIZE"),
    scheduledDelayMillis: getNumberFromEnv("OTEL_BSP_SCHEDULE_DELAY"),
    exportTimeoutMillis: getNumberFromEnv("OTEL_BSP_EXPORT_TIMEOUT"),
  };
}
