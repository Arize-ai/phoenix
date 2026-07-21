import type { SpanFilter } from "@arizeai/openinference-vercel" with {
  "resolution-mode": "import",
};
import type { Context } from "@opentelemetry/api";
import { diag } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanExporter,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";

type PendingStart = {
  span: Span;
  parentContext: Context;
};

/**
 * A span processor that lazily loads the OpenInference span processors from
 * `@arizeai/openinference-vercel`.
 *
 * `@arizeai/openinference-vercel` v3 is published as ESM-only (no `require`
 * export condition), so it cannot be loaded with `require()` from this
 * package's CommonJS build on any Node.js version. A dynamic `import()`,
 * however, can load ESM from CommonJS on every supported Node.js version
 * (>=18) — so the processors are loaded asynchronously and spans recorded
 * before the load completes are buffered and replayed.
 *
 * If the module cannot be loaded at all (e.g. a bundler stripped dynamic
 * imports), the processor falls back to the plain OpenTelemetry batch/simple
 * span processors: spans still reach Phoenix, but Vercel AI SDK telemetry is
 * not translated to OpenInference. A diagnostic warning is emitted in that
 * case.
 */
export class LazyOpenInferenceSpanProcessor implements SpanProcessor {
  private delegate: SpanProcessor | null = null;
  private pendingStarts: PendingStart[] = [];
  private pendingEnds: ReadableSpan[] = [];
  private readonly delegateReady: Promise<void>;

  constructor({
    exporter,
    batch,
    spanFilter,
    reparentOrphanedSpans,
  }: {
    exporter: SpanExporter;
    batch: boolean;
    spanFilter?: SpanFilter;
    reparentOrphanedSpans?: boolean;
  }) {
    this.delegateReady = import("@arizeai/openinference-vercel")
      .then((openInferenceVercel) => {
        this.setDelegate(
          batch
            ? new openInferenceVercel.OpenInferenceBatchSpanProcessor({
                exporter,
                spanFilter,
                reparentOrphanedSpans,
              })
            : new openInferenceVercel.OpenInferenceSimpleSpanProcessor({
                exporter,
                spanFilter,
                reparentOrphanedSpans,
              })
        );
      })
      .catch((error) => {
        diag.warn(
          "@arizeai/phoenix-otel: failed to load @arizeai/openinference-vercel; " +
            "spans will be exported without OpenInference translation of Vercel AI SDK telemetry, " +
            "and any spanFilter/reparentOrphanedSpans options will not apply.",
          error
        );
        this.setDelegate(
          batch
            ? new BatchSpanProcessor(exporter)
            : new SimpleSpanProcessor(exporter)
        );
      });
  }

  private setDelegate(delegate: SpanProcessor): void {
    this.delegate = delegate;
    // Replay spans recorded while the processor implementation was loading.
    // Starts are replayed before ends so processors observe the usual order.
    const starts = this.pendingStarts;
    const ends = this.pendingEnds;
    this.pendingStarts = [];
    this.pendingEnds = [];
    for (const { span, parentContext } of starts) {
      delegate.onStart(span, parentContext);
    }
    for (const span of ends) {
      delegate.onEnd(span);
    }
  }

  onStart(span: Span, parentContext: Context): void {
    if (this.delegate) {
      this.delegate.onStart(span, parentContext);
      return;
    }
    this.pendingStarts.push({ span, parentContext });
  }

  onEnd(span: ReadableSpan): void {
    if (this.delegate) {
      this.delegate.onEnd(span);
      return;
    }
    this.pendingEnds.push(span);
  }

  async forceFlush(): Promise<void> {
    await this.delegateReady;
    await this.delegate?.forceFlush();
  }

  async shutdown(): Promise<void> {
    await this.delegateReady;
    await this.delegate?.shutdown();
  }
}
