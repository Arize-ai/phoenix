import { z } from "zod";

import type {
  FinishedRecordedRun,
  RecordedRunEntry,
  RecordedRunResultState,
  RecordedRunRow,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import { isRecordedRunEntryRunnable } from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import type {
  ProjectEvaluatorRecordKind,
  ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** The most records one `evaluators.project.bench.run` call tests. */
export const MAX_BENCH_RUN_COUNT = 10;

export const DEFAULT_BENCH_RUN_COUNT = 3;

export const runProjectEvaluatorBenchInputSchema = z.strictObject({
  recordIds: z
    .array(z.string())
    .min(1)
    .max(MAX_BENCH_RUN_COUNT)
    .optional()
    .describe(
      "Records to test, by the `recordId` that `evaluators.project.bench.read` " +
        "lists (span id, trace id, or session id). Omit to test the most " +
        "recent runnable records."
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(MAX_BENCH_RUN_COUNT)
    .optional()
    .describe(
      `How many of the most recent runnable records to test when \`recordIds\` is omitted (default ${DEFAULT_BENCH_RUN_COUNT}).`
    ),
});

export type RunProjectEvaluatorBenchInput = z.output<
  typeof runProjectEvaluatorBenchInputSchema
>;

/** One annotation a preview produced, in the shape the agent reads. */
export type BenchAnnotationSummary = {
  name: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
};

/** What the bench shows for one record, as `evaluators.project.bench.read` lists it. */
export type BenchRecordSummary = {
  recordId: string;
  name: string;
  snippet: string | null;
  startTime: string | null;
  /**
   * `idle` (not tested), `running`, `annotated`, `failed`, `missing` (a
   * required input binds nothing on this record), or `unavailable` (the
   * server built no context for it).
   */
  status: RecordedRunResultState["kind"];
  /** Whether the result came from an earlier version of the draft. */
  isStale: boolean;
  annotations: BenchAnnotationSummary[];
  errors: string[];
  missingInputCount: number;
  unavailableReason: string | null;
};

export type BenchSnapshot = {
  targetType: ProjectEvaluatorTarget;
  recordKind: ProjectEvaluatorRecordKind;
  /** The bench's preview window, such as `7d`; records older than it are not listed. */
  timeWindow: string;
  /** The listed records, newest first; the bench lists at most a page. */
  records: BenchRecordSummary[];
  /** Whether older matching records exist beyond the listed page. */
  hasMore: boolean;
  /** Null when the draft can run; otherwise what stops every test. */
  runBlocker: string | null;
};

export function summarizeBenchEntry(
  entry: RecordedRunEntry
): BenchRecordSummary {
  const { row, resultState, missingCount } = entry;
  const base = {
    recordId: row.recordId,
    name: row.name,
    snippet: row.snippet ?? null,
    startTime: row.startTime ?? null,
    status: resultState.kind,
    missingInputCount: missingCount,
    unavailableReason: row.unavailableReason ?? null,
  };
  switch (resultState.kind) {
    case "annotated":
      return {
        ...base,
        isStale: resultState.isStale,
        annotations: resultState.annotations.map(toAnnotationSummary),
        errors: resultState.errors,
      };
    case "failed":
      return {
        ...base,
        isStale: resultState.isStale,
        annotations: [],
        errors: [resultState.message],
      };
    default:
      return { ...base, isStale: false, annotations: [], errors: [] };
  }
}

function toAnnotationSummary(annotation: {
  name: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
}): BenchAnnotationSummary {
  return {
    name: annotation.name,
    label: annotation.label,
    score: annotation.score,
    explanation: annotation.explanation,
  };
}

/** One record's outcome from `evaluators.project.bench.run`. */
export type BenchRunRecordResult = {
  recordId: string;
  name: string;
  status: "annotated" | "failed";
  annotations: BenchAnnotationSummary[];
  errors: string[];
};

export function summarizeFinishedRun({
  row,
  run,
}: {
  row: RecordedRunRow;
  run: FinishedRecordedRun;
}): BenchRunRecordResult {
  if (run.status === "error") {
    return {
      recordId: row.recordId,
      name: row.name,
      status: "failed",
      annotations: [],
      errors: [run.message],
    };
  }
  const annotations = run.results.flatMap(({ annotation }) =>
    annotation ? [toAnnotationSummary(annotation)] : []
  );
  const errors = run.results.flatMap(({ annotation, error }) =>
    annotation == null && error ? [error] : []
  );
  return {
    recordId: row.recordId,
    name: row.name,
    status: annotations.length > 0 ? "annotated" : "failed",
    annotations,
    errors:
      annotations.length === 0 && errors.length === 0
        ? ["The evaluator returned no annotation."]
        : errors,
  };
}

export type BenchRunSelection =
  | { ok: true; entries: RecordedRunEntry[] }
  | { ok: false; error: string };

/**
 * The entries a run tests: the named records, or the most recent runnable
 * ones. A named record the bench cannot run is an error rather than a skip,
 * so the agent learns why instead of reading a shorter result list.
 */
export function selectBenchRunEntries({
  entries,
  input,
}: {
  entries: readonly RecordedRunEntry[];
  input: RunProjectEvaluatorBenchInput;
}): BenchRunSelection {
  if (input.recordIds) {
    const selected: RecordedRunEntry[] = [];
    for (const recordId of input.recordIds) {
      const entry = entries.find(({ row }) => row.recordId === recordId);
      if (!entry) {
        return {
          ok: false,
          error: `Record ${recordId} is not listed on the bench. Read the bench for the listed recordIds; only the newest page of matching records is listed.`,
        };
      }
      if (!isRecordedRunEntryRunnable(entry)) {
        return {
          ok: false,
          error: `Record ${recordId} cannot be tested: ${describeUnrunnable(entry)}.`,
        };
      }
      selected.push(entry);
    }
    return { ok: true, entries: selected };
  }
  const runnable = entries.filter(isRecordedRunEntryRunnable);
  if (runnable.length === 0) {
    return {
      ok: false,
      error:
        entries.length === 0
          ? "No records match the scope in the bench's time window. Loosen the filter or check the target."
          : "None of the listed records can be tested right now (inputs unbound, no context, or a test already running).",
    };
  }
  return {
    ok: true,
    entries: runnable.slice(0, input.count ?? DEFAULT_BENCH_RUN_COUNT),
  };
}

function describeUnrunnable(entry: RecordedRunEntry): string {
  switch (entry.resultState.kind) {
    case "unavailable":
      return (
        entry.row.unavailableReason ?? "the server built no context for it"
      );
    case "missing":
      return `${entry.resultState.count} required input(s) bind nothing on it; fix the input mapping`;
    case "running":
      return "a test is already running on it";
    default:
      return "it is not runnable";
  }
}
