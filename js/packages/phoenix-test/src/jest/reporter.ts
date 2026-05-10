import { printSuiteSummaries } from "../core/reporter-format";
import { clearAllSuites, getAllSuites } from "../core/runner";

/**
 * Jest reporter for `@arizeai/phoenix-test`.
 *
 * Like the Vitest reporter, this does not replace Jest's default output. It
 * appends a Phoenix summary block at the end of the run.
 */
export default class PhoenixJestReporter {
  // jest passes globalConfig + reporterOptions; we ignore both
  constructor(_globalConfig?: unknown, _reporterOptions?: unknown) {}

  // Clear the suite registry at the start of each run so suites from a
  // previous --watch invocation don't leak forward.
  onRunStart(): void {
    clearAllSuites();
  }

  onRunComplete(): void {
    const suites = getAllSuites();
    if (suites.length === 0) return;
    printSuiteSummaries(suites);
  }
}
