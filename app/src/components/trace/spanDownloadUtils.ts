import chunk from "lodash/chunk";

import type { components } from "@phoenix/api/__generated__/v1";
import { authApiFetch } from "@phoenix/api/authApiFetch";
import { isAbortError } from "@phoenix/utils/errorUtils";

import {
  addAnnotationsToOtlpSpan,
  addAnnotationsToPhoenixSpan,
  applyAnnotationsToSpans,
  fetchAnnotationsForTargets,
  type SpanAnnotationTarget,
} from "./spanDownloadAnnotations";

type OtlpSpan = components["schemas"]["OtlpSpan"];
type PhoenixSpan = components["schemas"]["Span"];
type SpanAnnotation = components["schemas"]["SpanAnnotation"];
type TraceAnnotation = components["schemas"]["TraceAnnotation"];

const PAGE_SIZE = 1000;

// Cap IDs per request so the GET query string stays under common
// server/proxy URL-length limits (~8 KB) and the SQL IN() clause stays under
// database bound-parameter limits. A trace ID is 32 hex characters to a span
// ID's 16, so trace batches are half the size for a comparable query length.
const SPAN_ID_BATCH_SIZE = 250;
const TRACE_ID_BATCH_SIZE = 125;

// ID batches are independent of one another, so they are fetched in parallel.
// Kept modest to stay within the browser's per-host connection limit and to
// avoid starving the rest of the app of connections during a large export.
const ID_BATCH_CONCURRENCY = 6;

// Defer object-URL revocation so the browser has time to start reading a
// large blob before the URL is invalidated (matches the FileSaver pattern).
const URL_REVOKE_DELAY_MS = 40_000;

export type SpanDownloadScope = "spans" | "traces";
export type SpanDownloadFormat = "jsonl" | "otlp-json";
export type SingleSpanDownloadFormat = "json" | "otlp-json";

/**
 * How a bulk export ended. `cancelled` means the user dismissed the browser's
 * save-file picker, so nothing was written and nothing failed.
 */
export type SpanDownloadOutcome = "completed" | "cancelled";

export const SPAN_DOWNLOAD_FILE_EXTENSIONS: Record<SpanDownloadFormat, string> =
  {
    jsonl: ".jsonl",
    "otlp-json": ".json",
  };

const SPAN_DOWNLOAD_MIME_TYPES: Record<SpanDownloadFormat, string> = {
  jsonl: "application/x-ndjson",
  "otlp-json": "application/json",
};

// The OTLP JSON export is one `ExportTraceServiceRequest` whose span array is
// filled in incrementally, so the envelope is written around the pages.
const OTLP_ENVELOPE_PREFIX = '{"resource_spans":[{"scope_spans":[{"spans":[';
const OTLP_ENVELOPE_SUFFIX = "]}]}]}";

type SpanSearchQuery = {
  limit: number;
  span_id?: string[];
  trace_id?: string[];
  cursor?: string;
};

type SpanPage<Span> = { data: Span[]; next_cursor?: string | null };

type SpanDownloadIncludeAnnotations = {
  includeSpanAnnotations: boolean;
  includeTraceAnnotations: boolean;
};

/** How one span shape is fetched and how annotations are attached to it. */
type SpanExportFormat<Span> = {
  fetchPage: (query: SpanSearchQuery) => Promise<SpanPage<Span>>;
  getTarget: (span: Span) => SpanAnnotationTarget | null;
  withAnnotations: (
    span: Span,
    spanAnnotations: SpanAnnotation[],
    traceAnnotations: TraceAnnotation[]
  ) => Span;
};

/** Makes a name safe to use in a file name. */
export function sanitizeSpanDownloadFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_");
}

/** Returns a filesystem-friendly timestamp for generated download names. */
export function getSpanDownloadTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace(/:/g, "-");
}

/**
 * Turns an openapi-fetch error into an Error that preserves the HTTP status
 * and any server-provided detail.
 */
function toDownloadError({
  status,
  error,
}: {
  status: number;
  error: unknown;
}): Error {
  const detail =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "detail" in error
        ? String((error as { detail: unknown }).detail)
        : "";
  return new Error(detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`);
}

/**
 * Runs `run` over every item with at most `concurrency` calls in flight.
 * Rejects with the first error and stops handing out further items.
 * @param params.items - work items, consumed in order
 * @param params.concurrency - maximum number of concurrent `run` calls
 * @param params.run - the work to perform for a single item. Receives
 *   `hasFailed` so work that outlives a sibling's failure can bail out early
 *   instead of running to completion against a doomed export.
 */
async function runWithConcurrency<Item>({
  items,
  concurrency,
  run,
}: {
  items: Item[];
  concurrency: number;
  run: (item: Item, hasFailed: () => boolean) => Promise<void>;
}): Promise<void> {
  let nextIndex = 0;
  let hasFailed = false;
  const getHasFailed = () => hasFailed;
  const runWorker = async () => {
    while (!hasFailed && nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      try {
        await run(item, getHasFailed);
      } catch (error) {
        hasFailed = true;
        throw error;
      }
    }
  };
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
}

/**
 * Fetches every span matching the given span or trace IDs and hands each page
 * to the caller as it arrives.
 *
 * ID batches are fetched with bounded concurrency because they are
 * independent; only cursor pagination *within* a batch has to stay sequential.
 * Pages therefore arrive interleaved across batches, which both export formats
 * tolerate because neither is order-dependent.
 */
async function fetchSpans<Span>({
  spanIds,
  traceIds,
  fetchPage,
  onPage,
}: {
  spanIds?: string[];
  traceIds?: string[];
  fetchPage: (query: SpanSearchQuery) => Promise<SpanPage<Span>>;
  onPage: (spans: Span[]) => Promise<void>;
}): Promise<void> {
  const useSpanIds = spanIds != null;
  const idList = spanIds ?? traceIds ?? [];
  const batchSize = useSpanIds ? SPAN_ID_BATCH_SIZE : TRACE_ID_BATCH_SIZE;
  await runWithConcurrency({
    items: chunk(idList, batchSize),
    concurrency: ID_BATCH_CONCURRENCY,
    run: async (batch: string[], hasFailed) => {
      let cursor: string | null = null;
      do {
        const page = await fetchPage({
          limit: PAGE_SIZE,
          ...(useSpanIds ? { span_id: batch } : { trace_id: batch }),
          ...(cursor ? { cursor } : {}),
        });
        await onPage(page.data);
        cursor = page.next_cursor ?? null;
        // Another batch failing abandons the whole export, so there is no
        // point paginating this one to the end.
      } while (cursor && !hasFailed());
    },
  });
}

async function fetchOtlpSpanPage({
  projectId,
  query,
}: {
  projectId: string;
  query: SpanSearchQuery;
}): Promise<SpanPage<OtlpSpan>> {
  const { data, error, response } = await authApiFetch.GET(
    "/v1/projects/{project_identifier}/spans/otlpv1",
    { params: { path: { project_identifier: projectId }, query } }
  );
  if (data == null) {
    throw toDownloadError({ status: response.status, error });
  }
  return data;
}

async function fetchSpanPage({
  projectId,
  query,
}: {
  projectId: string;
  query: SpanSearchQuery;
}): Promise<SpanPage<PhoenixSpan>> {
  const { data, error, response } = await authApiFetch.GET(
    "/v1/projects/{project_identifier}/spans",
    { params: { path: { project_identifier: projectId }, query } }
  );
  if (data == null) {
    throw toDownloadError({ status: response.status, error });
  }
  return data;
}

function getPhoenixSpanTarget(span: PhoenixSpan): SpanAnnotationTarget {
  return {
    spanId: span.context.span_id,
    traceId: span.context.trace_id,
    isRoot: span.parent_id == null || span.parent_id === "",
  };
}

function getOtlpSpanTarget(span: OtlpSpan): SpanAnnotationTarget | null {
  if (span.span_id == null || span.trace_id == null) {
    return null;
  }
  return {
    spanId: span.span_id,
    traceId: span.trace_id,
    isRoot: span.parent_span_id == null || span.parent_span_id === "",
  };
}

function createPhoenixSpanFormat({
  projectId,
}: {
  projectId: string;
}): SpanExportFormat<PhoenixSpan> {
  return {
    fetchPage: (query) => fetchSpanPage({ projectId, query }),
    getTarget: getPhoenixSpanTarget,
    withAnnotations: (span, spanAnnotations, traceAnnotations) =>
      addAnnotationsToPhoenixSpan({ span, spanAnnotations, traceAnnotations }),
  };
}

function createOtlpSpanFormat({
  projectId,
}: {
  projectId: string;
}): SpanExportFormat<OtlpSpan> {
  return {
    fetchPage: (query) => fetchOtlpSpanPage({ projectId, query }),
    getTarget: getOtlpSpanTarget,
    withAnnotations: (span, spanAnnotations, traceAnnotations) =>
      addAnnotationsToOtlpSpan({ span, spanAnnotations, traceAnnotations }),
  };
}

/**
 * Loads the annotations for one page of spans and attaches them.
 *
 * Annotations are fetched per page rather than once for the whole export so
 * that pages can be written out as they arrive instead of being buffered until
 * the last span is known.
 *
 * A trace's spans can straddle pages, so `emittedTraceIds` records which
 * traces have already had their trace-level annotations written. The
 * annotations land on the first page to claim the trace, preferring a root
 * span within that page.
 *
 * Known limitation: because ID batches are fetched concurrently, the claiming
 * page — and therefore the carrier span — depends on which page arrives first.
 * A whole-export pass could always pick the root, but only by buffering every
 * span before writing any, which is exactly what streaming trades away.
 *
 * @param params.emittedTraceIds - mutated in place; shared across the export
 */
async function attachAnnotationsToPage<Span>({
  projectId,
  spans,
  exportFormat,
  emittedTraceIds,
  includeSpanAnnotations,
  includeTraceAnnotations,
}: {
  projectId: string;
  spans: Span[];
  exportFormat: SpanExportFormat<Span>;
  emittedTraceIds: Set<string>;
} & SpanDownloadIncludeAnnotations): Promise<Span[]> {
  const targets = spans.map(exportFormat.getTarget);
  const presentTargets = targets.filter(
    (target): target is SpanAnnotationTarget => target != null
  );
  // Claim traces before awaiting anything. A trace's annotations do not depend
  // on which page asked for them, so only the page that claims a trace needs
  // to fetch them — every later page it appears on skips the request outright.
  // Claiming synchronously is also what stops two concurrently processed pages
  // from both emitting the same trace's annotations.
  const claimedTargets = includeTraceAnnotations
    ? presentTargets.filter((target) => !emittedTraceIds.has(target.traceId))
    : [];
  for (const target of claimedTargets) {
    emittedTraceIds.add(target.traceId);
  }
  const [spanLookup, traceLookup] = await Promise.all([
    fetchAnnotationsForTargets({
      projectId,
      targets: presentTargets,
      includeSpanAnnotations,
      includeTraceAnnotations: false,
    }),
    fetchAnnotationsForTargets({
      projectId,
      targets: claimedTargets,
      includeSpanAnnotations: false,
      includeTraceAnnotations,
    }),
  ]);
  return applyAnnotationsToSpans({
    spans,
    targets,
    lookup: {
      spanAnnotationsBySpanId: spanLookup.spanAnnotationsBySpanId,
      traceAnnotationsByTraceId: traceLookup.traceAnnotationsByTraceId,
    },
    withAnnotations: exportFormat.withAnnotations,
  });
}

/** Downloads blob parts without first joining them into one large JS string. */
function downloadBlob({
  fileName,
  parts,
  type,
}: {
  fileName: string;
  parts: BlobPart[];
  type: string;
}) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
}

/**
 * Destination an export is written to incrementally, one page at a time.
 * Chunks land in the order `write` was called, so callers may issue writes
 * from concurrent fetches without interleaving them.
 */
type SpanExportWriter = {
  /** Appends a chunk of the export. */
  write: (text: string) => Promise<void>;
  /** Finalizes the file, making the export available to the user. */
  close: () => Promise<void>;
  /** Abandons the export so no partial file is left behind. */
  abort: () => Promise<void>;
};

/**
 * Minimal shape of the File System Access API's save picker. Declared locally
 * because `showSaveFilePicker` is not part of the TypeScript DOM lib.
 */
type ShowSaveFilePicker = (options: { suggestedName?: string }) => Promise<{
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
}>;

/** Buffers the whole export in memory and saves it via an object URL. */
function createBlobExportWriter({
  fileName,
  mimeType,
}: {
  fileName: string;
  mimeType: string;
}): SpanExportWriter {
  const parts: BlobPart[] = [];
  return {
    write: async (text) => {
      parts.push(text);
    },
    close: async () => {
      downloadBlob({ fileName, parts, type: mimeType });
    },
    // Nothing has reached the user yet — only `close` starts the download.
    abort: async () => {},
  };
}

/**
 * Opens the destination for an export.
 *
 * Prefers the File System Access API so pages stream straight to disk at
 * constant memory, which matters for exports of tens of thousands of spans.
 * Falls back to buffering in memory when the API is unavailable (Firefox and
 * Safari) or unusable — for instance when transient user activation has
 * expired, or in a sandboxed iframe. Returns `null` when the user dismisses
 * the save picker.
 *
 * @param params.fileName - suggested file name for the export
 * @param params.mimeType - content type used by the in-memory fallback
 */
async function openSpanExportWriter({
  fileName,
  mimeType,
}: {
  fileName: string;
  mimeType: string;
}): Promise<SpanExportWriter | null> {
  // Cast through `unknown` so this compiles whether or not the DOM lib in use
  // declares the File System Access API.
  const windowWithPicker = window as unknown as {
    showSaveFilePicker?: ShowSaveFilePicker;
  };
  if (windowWithPicker.showSaveFilePicker != null) {
    let fileHandle;
    try {
      fileHandle = await windowWithPicker.showSaveFilePicker({
        suggestedName: fileName,
      });
    } catch (error) {
      if (isAbortError(error)) {
        return null;
      }
      // The picker never opened, so nothing has been created on disk and the
      // in-memory fallback is still the download the user asked for.
      return createBlobExportWriter({ fileName, mimeType });
    }
    // Past this point the user has committed to a location and the browser has
    // created the file there. Degrading to a blob would leave that file empty
    // and quietly save the export somewhere else, so failures have to surface.
    const writable = await fileHandle.createWritable();
    return {
      write: (text) => writable.write(text),
      close: () => writable.close(),
      // A failed cleanup must not mask the error that triggered it.
      abort: () => writable.abort().catch(() => {}),
    };
  }
  return createBlobExportWriter({ fileName, mimeType });
}

/**
 * Turns pages of spans into export text.
 *
 * `serializePage` is called synchronously in write order, so a serializer may
 * carry mutable framing state — such as whether a separator is due — across
 * pages that arrive from concurrent batches.
 */
type SpanExportSerializer<Span> = {
  /** Written before the first page, if the format needs an opening. */
  prefix?: string;
  serializePage: (spans: Span[]) => string;
  /** Written after the last page, if the format needs a closing. */
  suffix?: string;
};

/** One span per line, so pages need no framing of their own. */
function createJsonlSerializer(): SpanExportSerializer<PhoenixSpan> {
  return {
    // Built in a single pass rather than `map(...).join(...)`, which would
    // hold a per-span array alongside the flattened result.
    serializePage: (spans) => {
      let text = "";
      for (const span of spans) {
        text += `${JSON.stringify(span)}\n`;
      }
      return text;
    },
  };
}

/** One `ExportTraceServiceRequest` whose span array is filled in page by page. */
function createOtlpJsonSerializer(): SpanExportSerializer<OtlpSpan> {
  let hasWrittenSpan = false;
  return {
    prefix: OTLP_ENVELOPE_PREFIX,
    serializePage: (spans) => {
      let text = "";
      for (const span of spans) {
        text += hasWrittenSpan
          ? `,${JSON.stringify(span)}`
          : JSON.stringify(span);
        hasWrittenSpan = true;
      }
      return text;
    },
    suffix: OTLP_ENVELOPE_SUFFIX,
  };
}

/**
 * Fetches, annotates, serializes and writes every page of one export.
 *
 * Serializing and writing a page happen in one synchronous step, so pages
 * arriving from concurrent ID batches keep their framing and their order in
 * step with the running span count.
 */
async function streamSpanExport<Span>({
  projectId,
  spanIds,
  traceIds,
  exportFormat,
  serializer,
  writer,
  onProgress,
  includeSpanAnnotations,
  includeTraceAnnotations,
}: {
  projectId: string;
  spanIds?: string[];
  traceIds?: string[];
  exportFormat: SpanExportFormat<Span>;
  serializer: SpanExportSerializer<Span>;
  writer: SpanExportWriter;
  onProgress?: (spanCount: number) => void;
} & SpanDownloadIncludeAnnotations): Promise<void> {
  let spanCount = 0;
  const emittedTraceIds = new Set<string>();
  if (serializer.prefix != null) {
    await writer.write(serializer.prefix);
  }
  await fetchSpans<Span>({
    spanIds,
    traceIds,
    fetchPage: exportFormat.fetchPage,
    onPage: async (spans) => {
      if (spans.length === 0) {
        return;
      }
      const annotatedSpans = await attachAnnotationsToPage({
        projectId,
        spans,
        exportFormat,
        emittedTraceIds,
        includeSpanAnnotations,
        includeTraceAnnotations,
      });
      spanCount += annotatedSpans.length;
      await writer.write(serializer.serializePage(annotatedSpans));
      onProgress?.(spanCount);
    },
  });
  if (serializer.suffix != null) {
    await writer.write(serializer.suffix);
  }
}

/**
 * Downloads spans or complete traces in one of the bulk export formats.
 *
 * @param params.projectId - project the spans belong to
 * @param params.spanIds - span IDs to export (not used with `traceIds`)
 * @param params.traceIds - trace IDs whose every span is exported
 * @param params.format - bulk export format
 * @param params.fileName - file name, including extension
 * @param params.includeSpanAnnotations - attach span annotations to each span
 * @param params.includeTraceAnnotations - attach trace annotations once per
 *   trace
 * @param params.onProgress - called with the running span count as pages land
 * @returns whether the export completed or the user dismissed the save picker
 */
export async function downloadSpanCollection({
  projectId,
  spanIds,
  traceIds,
  format,
  fileName,
  includeSpanAnnotations,
  includeTraceAnnotations,
  onProgress,
}: {
  projectId: string;
  spanIds?: string[];
  traceIds?: string[];
  format: SpanDownloadFormat;
  fileName: string;
  onProgress?: (spanCount: number) => void;
} & SpanDownloadIncludeAnnotations): Promise<SpanDownloadOutcome> {
  const writer = await openSpanExportWriter({
    fileName,
    mimeType: SPAN_DOWNLOAD_MIME_TYPES[format],
  });
  if (writer == null) {
    return "cancelled";
  }
  const shared = {
    projectId,
    spanIds,
    traceIds,
    writer,
    onProgress,
    includeSpanAnnotations,
    includeTraceAnnotations,
  };
  try {
    if (format === "jsonl") {
      await streamSpanExport({
        ...shared,
        exportFormat: createPhoenixSpanFormat({ projectId }),
        serializer: createJsonlSerializer(),
      });
    } else {
      await streamSpanExport({
        ...shared,
        exportFormat: createOtlpSpanFormat({ projectId }),
        serializer: createOtlpJsonSerializer(),
      });
    }
    // Closing is part of the export: a failure while flushing would otherwise
    // leave a truncated file behind with nothing to clean it up.
    await writer.close();
  } catch (error) {
    await writer.abort();
    throw error;
  }
  return "completed";
}

/** Fetches one span, attaches its annotations, and saves it as a blob. */
async function downloadSingleSpanWithFormat<Span>({
  projectId,
  spanId,
  exportFormat,
  fileName,
  toBlobParts,
  includeSpanAnnotations,
  includeTraceAnnotations,
}: {
  projectId: string;
  spanId: string;
  exportFormat: SpanExportFormat<Span>;
  fileName: string;
  toBlobParts: (span: Span) => BlobPart[];
} & SpanDownloadIncludeAnnotations): Promise<void> {
  const page = await exportFormat.fetchPage({ limit: 1, span_id: [spanId] });
  const span = page.data[0];
  if (span == null) {
    throw new Error("Span not found");
  }
  const [spanWithAnnotations] = await attachAnnotationsToPage({
    projectId,
    spans: [span],
    exportFormat,
    emittedTraceIds: new Set<string>(),
    includeSpanAnnotations,
    includeTraceAnnotations,
  });
  downloadBlob({
    fileName,
    parts: toBlobParts(spanWithAnnotations),
    type: "application/json",
  });
}

/**
 * Downloads one span as Phoenix JSON or an OTLP JSON export.
 *
 * A single span is small enough that it goes straight to a blob: there is
 * nothing to stream, and a save picker would be pure friction on what is
 * otherwise a one-click menu action.
 */
export async function downloadSingleSpan({
  projectId,
  spanId,
  format,
  fileName,
  includeSpanAnnotations,
  includeTraceAnnotations,
}: {
  projectId: string;
  spanId: string;
  format: SingleSpanDownloadFormat;
  fileName: string;
} & SpanDownloadIncludeAnnotations): Promise<void> {
  const shared = {
    projectId,
    spanId,
    fileName,
    includeSpanAnnotations,
    includeTraceAnnotations,
  };
  if (format === "otlp-json") {
    await downloadSingleSpanWithFormat({
      ...shared,
      exportFormat: createOtlpSpanFormat({ projectId }),
      toBlobParts: (span) => [
        OTLP_ENVELOPE_PREFIX,
        JSON.stringify(span),
        OTLP_ENVELOPE_SUFFIX,
      ],
    });
    return;
  }
  await downloadSingleSpanWithFormat({
    ...shared,
    exportFormat: createPhoenixSpanFormat({ projectId }),
    toBlobParts: (span) => [JSON.stringify(span, null, 2), "\n"],
  });
}
