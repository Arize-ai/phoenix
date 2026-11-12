import type {
  FinishedRecordedRun,
  RecordedRunEntry,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  type BenchSnapshot,
  runProjectEvaluatorBenchInputSchema,
  selectBenchRunEntries,
  summarizeBenchEntry,
  summarizeFinishedRun,
} from "./bench";

/**
 * The mounted test bench, as the bench operations drive it. The bench
 * remounts whenever the scope changes the records it lists, so a host names
 * the scope it was rendered for.
 */
export type ProjectEvaluatorBenchHost = {
  targetType: ProjectEvaluatorTarget;
  filterCondition: string;
  getEntries: () => RecordedRunEntry[];
  getSnapshot: () => BenchSnapshot;
  /** Runs the draft on each entry's record, as the row buttons do. */
  runEntries: (entries: RecordedRunEntry[]) => Promise<FinishedRecordedRun[]>;
};

export type ProjectEvaluatorBenchAccess = {
  getHost: () => ProjectEvaluatorBenchHost | null;
  /** The scope the form holds now; a bench for another scope is still loading. */
  getScope: () => { targetType: ProjectEvaluatorTarget; filterCondition: string };
  /** How long to wait for the bench to load the current scope's records. */
  loadTimeoutMs?: number;
  pollIntervalMs?: number;
};

const DEFAULT_LOAD_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 200;

/**
 * The bench for the form's current scope, waiting while it loads: right
 * after a scope edit the old records are on their way out.
 */
async function waitForCurrentBench({
  getHost,
  getScope,
  loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: ProjectEvaluatorBenchAccess): Promise<ProjectEvaluatorBenchHost | null> {
  const deadline = Date.now() + loadTimeoutMs;
  for (;;) {
    const host = getHost();
    const scope = getScope();
    if (
      host &&
      host.targetType === scope.targetType &&
      host.filterCondition === scope.filterCondition
    ) {
      return host;
    }
    if (Date.now() >= deadline) {
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

const LOADING_ERROR =
  "The test bench is still loading the records for the current scope; try again shortly.";

export function createReadProjectEvaluatorBenchClientAction(
  access: ProjectEvaluatorBenchAccess
) {
  return async (): Promise<AgentClientActionResult> => {
    const host = await waitForCurrentBench(access);
    if (!host) {
      return { ok: false, error: LOADING_ERROR };
    }
    return { ok: true, output: host.getSnapshot() };
  };
}

/**
 * Tests the open draft on real records through the bench itself, so the
 * rows the human sees fill in with the same results the agent reads back.
 */
export function createRunProjectEvaluatorBenchClientAction(
  access: ProjectEvaluatorBenchAccess
) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = runProjectEvaluatorBenchInputSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: "Invalid evaluators.project.bench.run input.",
      };
    }
    const host = await waitForCurrentBench(access);
    if (!host) {
      return { ok: false, error: LOADING_ERROR };
    }
    const { runBlocker } = host.getSnapshot();
    if (runBlocker) {
      return { ok: false, error: `The draft cannot be tested: ${runBlocker}.` };
    }
    const selection = selectBenchRunEntries({
      entries: host.getEntries(),
      input: parsed.data,
    });
    if (!selection.ok) {
      return selection;
    }
    const runs = await host.runEntries(selection.entries);
    const results = selection.entries.map((entry, index) =>
      summarizeFinishedRun({ row: entry.row, run: runs[index] })
    );
    return {
      ok: true,
      output: {
        targetType: host.targetType,
        tested: results.length,
        failed: results.filter(({ status }) => status === "failed").length,
        results,
        note: "Previews are not saved to the project.",
      },
    };
  };
}
