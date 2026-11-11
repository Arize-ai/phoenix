import type {
  BatchSpanProcessorOptions,
  SimpleSpanProcessorOptions,
} from "@opentelemetry/sdk-trace";
import {
  BatchSpanProcessor as SdkBatchSpanProcessor,
  SimpleSpanProcessor as SdkSimpleSpanProcessor,
} from "@opentelemetry/sdk-trace";

import {
  IGNORED_BSP_ENV_VARS,
  warnAboutIgnoredOtelEnvVars,
} from "./ignoredOtelEnvVars";

/**
 * Throws a descriptive error when a span processor is constructed without an
 * `{ exporter }` options object.
 *
 * OpenTelemetry JS 2.x span processors took the exporter positionally
 * (`new BatchSpanProcessor(exporter)`). The 3.x constructors accept that call
 * without complaint and then fail on the first export, so spans are dropped
 * and the only signal is a rejected `forceFlush()` or `shutdown()`.
 */
function assertExporterOptions(processorName: string, options: unknown): void {
  const exporter = (options as { exporter?: { export?: unknown } } | undefined)
    ?.exporter;
  if (typeof exporter?.export === "function") {
    return;
  }
  const passedExporterPositionally =
    typeof (options as { export?: unknown } | undefined)?.export === "function";
  throw new TypeError(
    passedExporterPositionally
      ? `${processorName} takes an options object: use new ${processorName}({ exporter }) ` +
          `instead of new ${processorName}(exporter). See MIGRATION.md in @arizeai/phoenix-otel.`
      : `${processorName} requires an exporter: new ${processorName}({ exporter }).`
  );
}

/**
 * The `@opentelemetry/sdk-trace` `BatchSpanProcessor`, which throws a
 * descriptive `TypeError` when it is not given an `{ exporter }` options
 * object, such as the OpenTelemetry JS 2.x form `new BatchSpanProcessor(exporter)`.
 * It also warns once per variable when an `OTEL_BSP_*` variable is set and the
 * matching option is left out, since OpenTelemetry JS 3 no longer reads them.
 *
 * Passing `spanProcessors` to `register()` replaces the default Phoenix
 * exporter, so give the exporter its Phoenix URL and auth yourself.
 *
 * @example
 * ```typescript
 * import {
 *   BatchSpanProcessor,
 *   ensureCollectorEndpoint,
 *   OTLPTraceExporter,
 *   register,
 * } from "@arizeai/phoenix-otel";
 *
 * register({
 *   spanProcessors: [
 *     new BatchSpanProcessor({
 *       exporter: new OTLPTraceExporter({
 *         url: ensureCollectorEndpoint("http://localhost:6006"),
 *         headers: { authorization: `Bearer ${process.env.PHOENIX_API_KEY}` },
 *       }),
 *       scheduledDelayMillis: 1000,
 *     }),
 *   ],
 * });
 * ```
 */
export class BatchSpanProcessor extends SdkBatchSpanProcessor {
  constructor(options: BatchSpanProcessorOptions) {
    assertExporterOptions("BatchSpanProcessor", options);
    warnAboutIgnoredOtelEnvVars(
      IGNORED_BSP_ENV_VARS.filter(
        ([, field]) => options[field] === undefined
      ).map(([key]) => key),
      "the matching option of new BatchSpanProcessor({ exporter, ... })"
    );
    super(options);
  }
}

/**
 * The `@opentelemetry/sdk-trace` `SimpleSpanProcessor`, which throws a
 * descriptive `TypeError` when it is not given an `{ exporter }` options
 * object, such as the OpenTelemetry JS 2.x form `new SimpleSpanProcessor(exporter)`.
 */
export class SimpleSpanProcessor extends SdkSimpleSpanProcessor {
  constructor(options: SimpleSpanProcessorOptions) {
    assertExporterOptions("SimpleSpanProcessor", options);
    super(options);
  }
}
