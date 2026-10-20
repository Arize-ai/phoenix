import { isStringKeyedObject } from "@phoenix/typeUtils";
import { toContentPreview } from "@phoenix/utils/contentPreviewUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

/** One evaluator's verdict on one record, as the preview returns it. */
export type RecordedRunResult = {
  readonly evaluatorName: string;
  readonly annotation: {
    readonly name: string;
    readonly label: string | null;
    readonly score: number | null;
    readonly explanation: string | null;
  } | null;
  readonly error: string | null;
};

/**
 * A run remembers the evaluator definition it was produced by, so a later
 * edit to the prompt, model, mapping, or annotation config can mark it stale
 * instead of letting it sit beside a definition it did not come from.
 */
export type RecordedRun = { fingerprint: string } & (
  | {
      status: "running";
      /** The run this one replaces, if the record had been tested before. */
      previous?: FinishedRecordedRun;
    }
  | { status: "done"; results: RecordedRunResult[] }
  | { status: "error"; message: string }
);

export type FinishedRecordedRun = Exclude<RecordedRun, { status: "running" }>;

/** A recent record the evaluator can be tested against. */
export type RecordedRunRow = {
  /** Stable identity: the record's node id, or {@link SAMPLE_ROW_KEY}. */
  key: string;
  /** The span's name, the trace's root span name, or the session's id. */
  name: string;
  /** The record's own identifier: span id, trace id, or session id. */
  recordId: string;
  /** The row's one-line excerpt: the latest input, falling back to output. */
  snippet?: string;
  spanKind?: string;
  startTime?: string;
  latencyMs?: number | null;
  /** A per-kind size summary, such as "12 spans · 3,400 tokens". */
  metric?: string;
  context: unknown;
  isSample: boolean;
  /**
   * Why this record has no context to bind against. Set only when the server
   * cannot produce one, in which case a live evaluation would fail the same way.
   */
  unavailableReason?: string;
  /** An in-app path that opens the record in its own viewer. */
  href?: string;
};

export const SAMPLE_ROW_KEY = "__sample__";

/**
 * What the Result column and the inspector say about one row, checked in the
 * order a test would fail: a record nothing can run on, a run in flight, a
 * mapping that binds nothing right now, then whatever the last run returned.
 *
 * A current missing input outranks an earlier verdict: the verdict came from
 * a definition that did not have the variable, and a test now would fail.
 */
export type RecordedRunAnnotation = NonNullable<
  RecordedRunResult["annotation"]
>;

export type RecordedRunResultState =
  | { kind: "unavailable" }
  | { kind: "running" }
  | { kind: "missing"; count: number }
  | {
      kind: "annotated";
      /** Every annotation the run produced, one per output, in order. */
      annotations: RecordedRunAnnotation[];
      /**
       * What the outputs that produced no annotation said instead. An
       * evaluator with several outputs can annotate with one and fail with
       * another; the failure is kept so it is shown beside the verdict.
       */
      errors: string[];
      isStale: boolean;
    }
  | {
      kind: "failed";
      /** What went wrong, as the server or the evaluator said it. */
      message: string;
      isStale: boolean;
    }
  | { kind: "idle" };

export function isRecordedRunStale(
  run: RecordedRun | undefined,
  currentFingerprint: string
): boolean {
  return run != null && run.fingerprint !== currentFingerprint;
}

export function getRecordedRunResultState({
  run,
  missingCount,
  isUnavailable,
  currentFingerprint,
}: {
  run: RecordedRun | undefined;
  missingCount: number;
  isUnavailable: boolean;
  /** The definition the bench is showing now; see {@link RecordedRun}. */
  currentFingerprint: string;
}): RecordedRunResultState {
  if (isUnavailable) {
    return { kind: "unavailable" };
  }
  if (run?.status === "running") {
    return { kind: "running" };
  }
  if (missingCount > 0) {
    return { kind: "missing", count: missingCount };
  }
  const isStale = isRecordedRunStale(run, currentFingerprint);
  if (run?.status === "done") {
    const annotations = run.results.flatMap(({ annotation }) =>
      annotation != null ? [annotation] : []
    );
    const errors = run.results.flatMap(({ annotation, error }) =>
      annotation == null && error ? [error] : []
    );
    if (annotations.length > 0) {
      return { kind: "annotated", annotations, errors, isStale };
    }
    return {
      kind: "failed",
      message:
        errors.length > 0
          ? errors.join("\n")
          : "The evaluator returned no annotation.",
      isStale,
    };
  }
  if (run?.status === "error") {
    return { kind: "failed", message: run.message, isStale };
  }
  return { kind: "idle" };
}

/** A row with its mapping checked against it and its run attached. */
export type RecordedRunEntry = {
  row: RecordedRunRow;
  missingCount: number;
  run: RecordedRun | undefined;
  resultState: RecordedRunResultState;
};

/** Whether a test can start on this row right now. */
export function isRecordedRunEntryRunnable(entry: RecordedRunEntry): boolean {
  const { kind } = entry.resultState;
  return kind !== "unavailable" && kind !== "missing" && kind !== "running";
}

export type RecordedRunSummary = {
  tested: number;
  stale: number;
  failed: number;
  running: number;
  notTested: number;
};

/** Adds up the rows' outcomes for the status line. */
export function summarizeRecordedRuns(
  entries: readonly RecordedRunEntry[]
): RecordedRunSummary {
  const summary: RecordedRunSummary = {
    tested: 0,
    stale: 0,
    failed: 0,
    running: 0,
    notTested: 0,
  };
  for (const { resultState } of entries) {
    switch (resultState.kind) {
      case "running":
        summary.running += 1;
        break;
      case "annotated":
        if (resultState.isStale) {
          summary.stale += 1;
        } else if (resultState.errors.length > 0) {
          // An output that failed fails the record, whatever the others said.
          summary.failed += 1;
        } else {
          summary.tested += 1;
        }
        break;
      case "failed":
        if (resultState.isStale) {
          summary.stale += 1;
        } else {
          summary.failed += 1;
        }
        break;
      default:
        summary.notTested += 1;
    }
  }
  return summary;
}

/** "3 tested · 1 stale · 2 not tested", dropping the parts that are zero. */
export function formatRecordedRunSummary(summary: RecordedRunSummary): string {
  const parts: string[] = [];
  if (summary.tested > 0) {
    parts.push(`${summary.tested} tested`);
  }
  if (summary.running > 0) {
    parts.push(`${summary.running} testing`);
  }
  if (summary.stale > 0) {
    parts.push(`${summary.stale} stale`);
  }
  if (summary.failed > 0) {
    parts.push(`${summary.failed} failed`);
  }
  if (summary.notTested > 0) {
    parts.push(`${summary.notTested} not tested`);
  }
  return parts.join(" · ");
}

/**
 * What the header's bulk button says. "All" is only claimed when every row
 * can run; otherwise the label counts what will run against what is listed,
 * so "Test 7 of 10" never reads as a bug. "Re-test" is the verb once every
 * row about to run already has a result.
 */
export function formatBulkTestLabel({
  runnableCount,
  totalCount,
  isRetest,
}: {
  /** Listed rows that can run right now. */
  runnableCount: number;
  /** Every listed row. */
  totalCount: number;
  /** Whether every row about to run already has a result. */
  isRetest: boolean;
}): string {
  const verb = isRetest ? "Re-test" : "Test";
  if (runnableCount === 0) {
    return `${verb} all`;
  }
  return runnableCount === totalCount
    ? `${verb} all ${runnableCount}`
    : `${verb} ${runnableCount} of ${totalCount}`;
}

/** The leading characters a hex id is recognised by in a dense row. */
export const SHORT_ID_LENGTH = 8;

/**
 * Span and trace ids are long hex strings a reader recognises by their head;
 * those are cut to {@link SHORT_ID_LENGTH}. A session id is whatever the
 * application chose, often a readable name, so it is shown whole.
 */
export function shortenRecordId(recordId: string): string {
  return /^[0-9a-f]{16,}$/i.test(recordId)
    ? recordId.slice(0, SHORT_ID_LENGTH)
    : recordId;
}

/**
 * The server builds a span's context through the dataset-example conversion,
 * which wraps a plain-string `input.value` as `{ "input": "…" }` and a
 * plain-string output as `{ "output": "…" }`. A reader wants the text, not
 * the envelope, so a single-key object holding one string reads as that
 * string. Anything with more structure is left alone.
 */
export function unwrapSingleStringValue(value: unknown): unknown {
  if (!isStringKeyedObject(value)) {
    return value;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return value;
  }
  const inner = value[keys[0] as string];
  return typeof inner === "string" ? inner : value;
}

/**
 * The row excerpt for a record: its input, falling back to its output. An LLM
 * span's input often arrives as a serialized chat payload, so surface the
 * latest message's text rather than the raw JSON envelope; a plain string
 * arrives wrapped in a one-key object and is unwrapped the same way.
 */
export function getContextSnippet(context: unknown): string {
  if (!isStringKeyedObject(context)) {
    return "";
  }
  return (
    toContentPreview(toReadableValue(context.input)) ??
    toContentPreview(toReadableValue(context.output)) ??
    ""
  );
}

/** The text a reader means when they point at a context value. */
export function toReadableValue(value: unknown): unknown {
  const unwrapped = unwrapSingleStringValue(value);
  return getLatestMessageText(unwrapped) ?? unwrapped;
}

/** The text of the last non-empty message in a chat payload, if it is one. */
function getLatestMessageText(value: unknown): string | null {
  const payload =
    typeof value === "string" && value.trimStart().startsWith("{")
      ? safelyParseJSON(value).json
      : value;
  if (!isStringKeyedObject(payload) || !Array.isArray(payload.messages)) {
    return null;
  }
  for (let index = payload.messages.length - 1; index >= 0; index--) {
    const message: unknown = payload.messages[index];
    const content = isStringKeyedObject(message) ? message.content : null;
    if (typeof content === "string" && content.trim()) {
      return content;
    }
  }
  return null;
}
