import chunk from "lodash/chunk";

import type { components } from "@phoenix/api/__generated__/v1";
import { authApiFetch } from "@phoenix/api/authApiFetch";

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
// server/proxy URL-length limits and the SQL IN() clause stays under database
// bound-parameter limits.
const ID_BATCH_SIZE = 100;

// Defer object-URL revocation so the browser has time to start reading a
// large blob before the URL is invalidated (matches the FileSaver pattern).
const URL_REVOKE_DELAY_MS = 40_000;

export type SpanDownloadScope = "spans" | "traces";
export type SpanDownloadFormat = "jsonl" | "otlp-json";
export type SingleSpanDownloadFormat = "json" | "otlp-json";

export const SPAN_DOWNLOAD_FILE_EXTENSIONS: Record<SpanDownloadFormat, string> =
  {
    jsonl: ".jsonl",
    "otlp-json": ".json",
  };

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

type SpanExportFormat<Span> = {
  fetchPage: (query: SpanSearchQuery) => Promise<SpanPage<Span>>;
  getTarget: (span: Span) => SpanAnnotationTarget | null;
  withAnnotations: (
    span: Span,
    spanAnnotations: SpanAnnotation[],
    traceAnnotations: TraceAnnotation[]
  ) => Span;
  toBlobParts: (spans: Span[]) => BlobPart[];
  mimeType: string;
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
 * Fetches every span matching the given span or trace IDs and hands each page
 * to the caller as it arrives.
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
  onPage: (spans: Span[]) => void | Promise<void>;
}): Promise<void> {
  const useSpanIds = spanIds != null;
  const idList = spanIds ?? traceIds ?? [];
  for (const batch of chunk(idList, ID_BATCH_SIZE)) {
    let cursor: string | null = null;
    do {
      const page = await fetchPage({
        limit: PAGE_SIZE,
        ...(useSpanIds ? { span_id: batch } : { trace_id: batch }),
        ...(cursor ? { cursor } : {}),
      });
      await onPage(page.data);
      cursor = page.next_cursor ?? null;
    } while (cursor);
  }
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

/** Emits JSONL as page-sized BlobParts instead of one giant joined string. */
function toJsonlBlobParts(spans: PhoenixSpan[]): BlobPart[] {
  if (spans.length === 0) {
    return [];
  }
  const parts: BlobPart[] = [];
  for (const batch of chunk(spans, PAGE_SIZE)) {
    parts.push(batch.map((span) => JSON.stringify(span)).join("\n"));
    parts.push("\n");
  }
  return parts;
}

/**
 * Emits OTLP JSON with open/body/close framing so each page is its own
 * BlobPart rather than one JSON.stringify of the full spans array.
 */
function toOtlpBlobParts(spans: OtlpSpan[]): BlobPart[] {
  const parts: BlobPart[] = ['{"resource_spans":[{"scope_spans":[{"spans":['];
  let isFirstBatch = true;
  for (const batch of chunk(spans, PAGE_SIZE)) {
    if (batch.length === 0) {
      continue;
    }
    const serialized = batch.map((span) => JSON.stringify(span)).join(",");
    parts.push(isFirstBatch ? serialized : `,${serialized}`);
    isFirstBatch = false;
  }
  parts.push("]}]}]}");
  return parts;
}

function createPhoenixJsonlFormat({
  projectId,
}: {
  projectId: string;
}): SpanExportFormat<PhoenixSpan> {
  return {
    fetchPage: (query) => fetchSpanPage({ projectId, query }),
    getTarget: getPhoenixSpanTarget,
    withAnnotations: (span, spanAnnotations, traceAnnotations) =>
      addAnnotationsToPhoenixSpan({ span, spanAnnotations, traceAnnotations }),
    toBlobParts: toJsonlBlobParts,
    mimeType: "application/x-ndjson",
  };
}

function createOtlpJsonFormat({
  projectId,
}: {
  projectId: string;
}): SpanExportFormat<OtlpSpan> {
  return {
    fetchPage: (query) => fetchOtlpSpanPage({ projectId, query }),
    getTarget: getOtlpSpanTarget,
    withAnnotations: (span, spanAnnotations, traceAnnotations) =>
      addAnnotationsToOtlpSpan({ span, spanAnnotations, traceAnnotations }),
    toBlobParts: toOtlpBlobParts,
    mimeType: "application/json",
  };
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

async function downloadWithFormat<Span>({
  projectId,
  spanIds,
  traceIds,
  exportFormat,
  fileName,
  includeSpanAnnotations,
  includeTraceAnnotations,
}: {
  projectId: string;
  spanIds?: string[];
  traceIds?: string[];
  exportFormat: SpanExportFormat<Span>;
  fileName: string;
} & SpanDownloadIncludeAnnotations): Promise<void> {
  const spans: Span[] = [];
  await fetchSpans({
    spanIds,
    traceIds,
    fetchPage: exportFormat.fetchPage,
    onPage: (pageSpans) => {
      spans.push(...pageSpans);
    },
  });
  const targets = spans.map(exportFormat.getTarget);
  const lookup = await fetchAnnotationsForTargets({
    projectId,
    targets: targets.filter(
      (target): target is SpanAnnotationTarget => target != null
    ),
    includeSpanAnnotations,
    includeTraceAnnotations,
  });
  const spansWithAnnotations = applyAnnotationsToSpans({
    spans,
    targets,
    lookup,
    withAnnotations: exportFormat.withAnnotations,
  });
  downloadBlob({
    fileName,
    parts: exportFormat.toBlobParts(spansWithAnnotations),
    type: exportFormat.mimeType,
  });
}

/** Downloads spans or complete traces in one of the bulk export formats. */
export async function downloadSpanCollection({
  projectId,
  spanIds,
  traceIds,
  format,
  fileName,
  includeSpanAnnotations,
  includeTraceAnnotations,
}: {
  projectId: string;
  spanIds?: string[];
  traceIds?: string[];
  format: SpanDownloadFormat;
  fileName: string;
} & SpanDownloadIncludeAnnotations): Promise<void> {
  const shared = {
    projectId,
    spanIds,
    traceIds,
    fileName,
    includeSpanAnnotations,
    includeTraceAnnotations,
  };
  if (format === "jsonl") {
    await downloadWithFormat({
      ...shared,
      exportFormat: createPhoenixJsonlFormat({ projectId }),
    });
    return;
  }
  await downloadWithFormat({
    ...shared,
    exportFormat: createOtlpJsonFormat({ projectId }),
  });
}

/** Downloads one span as Phoenix JSON or an OTLP JSON export. */
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
  if (format === "otlp-json") {
    await downloadSpanCollection({
      projectId,
      spanIds: [spanId],
      format,
      fileName,
      includeSpanAnnotations,
      includeTraceAnnotations,
    });
    return;
  }

  const page = await fetchSpanPage({
    projectId,
    query: { limit: 1, span_id: [spanId] },
  });
  const span = page.data[0];
  if (span == null) {
    throw new Error("Span not found");
  }
  const target = getPhoenixSpanTarget(span);
  const lookup = await fetchAnnotationsForTargets({
    projectId,
    targets: [target],
    includeSpanAnnotations,
    includeTraceAnnotations,
  });
  const spanWithAnnotations = addAnnotationsToPhoenixSpan({
    span,
    spanAnnotations: lookup.spanAnnotationsBySpanId.get(target.spanId) ?? [],
    traceAnnotations:
      lookup.traceAnnotationsByTraceId.get(target.traceId) ?? [],
  });
  downloadBlob({
    fileName,
    parts: [JSON.stringify(spanWithAnnotations, null, 2), "\n"],
    type: "application/json",
  });
}
