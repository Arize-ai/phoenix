import type { Trace } from "../trace";

export type OutputFormat = "pretty" | "json" | "raw";

const INPUT_VALUE_ATTRIBUTE = "input.value";
const OUTPUT_VALUE_ATTRIBUTE = "output.value";
const VALUE_PREVIEW_MAX_CHARS = 200;

export interface FormatTraceOutputOptions {
  /**
   * Trace to format.
   */
  trace: Trace;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatTraceOutput({
  trace,
  format,
}: FormatTraceOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(trace);
  }
  if (selected === "json") {
    return JSON.stringify(trace, null, 2);
  }
  return formatTracePretty(trace);
}

export interface FormatTracesOutputOptions {
  /**
   * Traces to format.
   */
  traces: Trace[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatTracesOutput({
  traces,
  format,
}: FormatTracesOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(traces);
  }
  if (selected === "json") {
    return JSON.stringify(traces, null, 2);
  }
  if (traces.length === 0) {
    return "No traces found";
  }
  return traces
    .map((t) => formatTracePretty(t))
    .join("\n\n" + "=".repeat(80) + "\n\n");
}

function formatTracePretty(trace: Trace): string {
  const lines: string[] = [];

  lines.push(`┌─ Trace: ${trace.traceId}`);
  lines.push(`│`);

  const forest = buildSpanForest(trace.spans);
  const rootWithIo = forest.find((n) => {
    const attrs = n.span.attributes;
    return (
      previewAttributeValue(attrs?.[INPUT_VALUE_ATTRIBUTE]) !== undefined ||
      previewAttributeValue(attrs?.[OUTPUT_VALUE_ATTRIBUTE]) !== undefined
    );
  });

  if (rootWithIo) {
    const inputPreview = previewAttributeValue(
      rootWithIo.span.attributes?.[INPUT_VALUE_ATTRIBUTE]
    );
    const outputPreview = previewAttributeValue(
      rootWithIo.span.attributes?.[OUTPUT_VALUE_ATTRIBUTE]
    );

    if (inputPreview) lines.push(`│  Input: ${inputPreview}`);
    if (outputPreview) lines.push(`│  Output: ${outputPreview}`);
    if (inputPreview || outputPreview) lines.push(`│`);
  }

  lines.push(`│  Spans:`);

  for (let i = 0; i < forest.length; i++) {
    renderSpanNode(lines, forest[i]!, {
      ancestors: [],
      isLast: i === forest.length - 1,
    });
  }

  lines.push(`└─`);
  return lines.join("\n");
}

type Span = Trace["spans"][number];

type SpanNode = {
  span: Span;
  children: SpanNode[];
};

function buildSpanForest(spans: Span[]): SpanNode[] {
  const spanIdToSpan = new Map<string, Span>();
  const spanIdToNode = new Map<string, SpanNode>();
  const parentIdToChildren = new Map<string, Span[]>();

  for (const span of spans) {
    const spanId = span.context?.span_id;
    if (!spanId) continue;
    spanIdToSpan.set(spanId, span);
  }

  for (const span of spans) {
    const parentId = span.parent_id ?? null;
    if (!parentId) continue;
    if (!parentIdToChildren.has(parentId)) {
      parentIdToChildren.set(parentId, []);
    }
    parentIdToChildren.get(parentId)!.push(span);
  }

  const getNode = (span: Span): SpanNode => {
    const spanId = span.context.span_id;
    const existing = spanIdToNode.get(spanId);
    if (existing) return existing;
    const node: SpanNode = { span, children: [] };
    spanIdToNode.set(spanId, node);
    return node;
  };

  // roots: no parent_id, or parent_id not present in this trace
  const roots: Span[] = [];
  for (const span of spans) {
    const parentId = span.parent_id ?? null;
    if (!parentId || !spanIdToSpan.has(parentId)) {
      roots.push(span);
    }
  }

  const sortByStartTime = (a: Span, b: Span): number => {
    const aStart = Date.parse(a.start_time);
    const bStart = Date.parse(b.start_time);
    if (!Number.isNaN(aStart) && !Number.isNaN(bStart)) {
      return aStart - bStart;
    }
    return String(a.name).localeCompare(String(b.name));
  };

  const buildNodeRec = (span: Span): SpanNode => {
    const node = getNode(span);
    const children = parentIdToChildren.get(span.context.span_id) ?? [];
    children.sort(sortByStartTime);
    node.children = children.map(buildNodeRec);
    return node;
  };

  roots.sort(sortByStartTime);
  return roots.map(buildNodeRec);
}

function renderSpanNode(
  lines: string[],
  node: SpanNode,
  opts: { ancestors: boolean[]; isLast: boolean }
): void {
  const { span, children } = node;

  const baseIndent = "│  ";
  const treePrefix = opts.ancestors
    .map((ancestorIsLast) => (ancestorIsLast ? "   " : "│  "))
    .join("");
  const connector = opts.isLast ? "└─" : "├─";

  const status = span.status_code === "ERROR" ? "✗" : "✓";
  const kind = span.span_kind;
  const duration = formatDurationMs(span.start_time, span.end_time);

  lines.push(
    `${baseIndent}${treePrefix}${connector} ${status} ${span.name} (${kind}) - ${duration}`
  );

  const nextAncestors = [...opts.ancestors, opts.isLast];
  for (let i = 0; i < children.length; i++) {
    renderSpanNode(lines, children[i]!, {
      ancestors: nextAncestors,
      isLast: i === children.length - 1,
    });
  }
}

function formatDurationMs(startTime: string, endTime: string): string {
  const startMs = Date.parse(startTime);
  const endMs = Date.parse(endTime);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "n/a";
  }
  return `${Math.max(0, endMs - startMs)}ms`;
}

function previewAttributeValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  let str: string;
  if (typeof value === "string") {
    str = value;
  } else {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  }

  str = str.replace(/\s+/g, " ").trim();
  if (!str) {
    return undefined;
  }

  if (str.length > VALUE_PREVIEW_MAX_CHARS) {
    return `${str.slice(0, VALUE_PREVIEW_MAX_CHARS)}…`;
  }
  return str;
}
