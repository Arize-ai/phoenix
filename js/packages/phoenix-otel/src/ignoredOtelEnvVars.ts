import type {
  BatchSpanProcessorOptions,
  SpanLimits,
} from "@opentelemetry/sdk-trace";

/**
 * `OTEL_*` span limit variables the OpenTelemetry JS 2.x SDK read and JS 3
 * ignores, with the `SpanLimits` field each one set.
 */
export const IGNORED_SPAN_LIMIT_ENV_VARS: ReadonlyArray<
  readonly [key: string, field: keyof SpanLimits]
> = [
  ["OTEL_ATTRIBUTE_COUNT_LIMIT", "attributeCountLimit"],
  ["OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT", "attributeValueLengthLimit"],
  ["OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT", "attributeCountLimit"],
  ["OTEL_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT", "attributePerEventCountLimit"],
  ["OTEL_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT", "attributePerLinkCountLimit"],
  ["OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT", "attributeValueLengthLimit"],
  ["OTEL_SPAN_EVENT_COUNT_LIMIT", "eventCountLimit"],
  ["OTEL_SPAN_LINK_COUNT_LIMIT", "linkCountLimit"],
];

/**
 * `OTEL_BSP_*` variables every OpenTelemetry JS 2.x `BatchSpanProcessor` read
 * and JS 3 ignores, with the `BatchSpanProcessorOptions` field each one set.
 */
export const IGNORED_BSP_ENV_VARS: ReadonlyArray<
  readonly [key: string, field: keyof BatchSpanProcessorOptions]
> = [
  ["OTEL_BSP_EXPORT_TIMEOUT", "exportTimeoutMillis"],
  ["OTEL_BSP_MAX_EXPORT_BATCH_SIZE", "maxExportBatchSize"],
  ["OTEL_BSP_MAX_QUEUE_SIZE", "maxQueueSize"],
  ["OTEL_BSP_SCHEDULE_DELAY", "scheduledDelayMillis"],
];

const warnedIgnoredOtelEnvVars = new Set<string>();

/**
 * Logs one warning naming the given `OTEL_*` variables that are set and have
 * not been warned about in this process. Without this, a setting such as
 * `OTEL_TRACES_SAMPLER=always_off` that used to disable tracing is silently
 * dropped and spans start exporting.
 *
 * @param keys - variables the caller did not configure in code
 * @param replacement - what to use instead, e.g. "the `sampler` option of register()"
 */
export function warnAboutIgnoredOtelEnvVars(
  keys: readonly string[],
  replacement: string
): void {
  if (typeof process === "undefined" || !process.env) {
    return;
  }
  const setKeys = keys.filter(
    (key) =>
      process.env[key] !== undefined && !warnedIgnoredOtelEnvVars.has(key)
  );
  if (setKeys.length === 0) {
    return;
  }
  setKeys.forEach((key) => warnedIgnoredOtelEnvVars.add(key));
  // eslint-disable-next-line no-console
  console.warn(
    `@arizeai/phoenix-otel: ${setKeys.join(", ")} ${setKeys.length === 1 ? "is" : "are"} set but ignored: ` +
      `OpenTelemetry JS 3 no longer reads ${setKeys.length === 1 ? "it" : "them"}. ` +
      `Use ${replacement} instead. See MIGRATION.md in @arizeai/phoenix-otel.`
  );
}

/** @internal Resets the one-time ignored `OTEL_*` variable warning latch for tests. */
export function resetIgnoredOtelEnvVarWarningsForTesting(): void {
  warnedIgnoredOtelEnvVars.clear();
}
