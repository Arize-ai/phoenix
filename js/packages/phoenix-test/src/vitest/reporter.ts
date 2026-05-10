import {
  formatSuiteSummary,
  printSuiteSummaries,
} from "../core/reporter-format";
import { clearAllSuites, getAllSuites } from "../core/runner";

/**
 * Vitest reporter for `@arizeai/phoenix-test`.
 *
 * The reporter does not replace Vitest's default test output. Instead it
 * appends a Phoenix-flavored summary at the end of the run that lists
 * outputs, annotations, and dataset/experiment links for each suite.
 *
 * The class implements the Vitest `Reporter` interface structurally rather
 * than nominally so we don't have to import a CJS type from `vitest/reporters`.
 */
export default class PhoenixVitestReporter {
  // Clear the suite registry at the start of each run so suites from
  // previous watch-mode runs don't leak forward.
  onTestRunStart(): void {
    clearAllSuites();
  }
  onTestRunEnd(): void {
    const suites = getAllSuites();
    if (suites.length === 0) return;
    printSuiteSummaries(suites);
  }
  // Vitest also calls `onFinished` on legacy reporters; alias for safety.
  onFinished(): void {
    this.onTestRunEnd();
  }
}

export { formatSuiteSummary, printSuiteSummaries };
