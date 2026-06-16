import {
  clearSuiteSummaryArtifacts,
  readSuiteSummaryArtifacts,
} from "../testing/core/report-artifacts";
import {
  formatSuiteSummary,
  printSuiteSummaries,
} from "../testing/core/reporter-format";
import { clearAllSuites, getAllSuites } from "../testing/core/runner";

/**
 * Vitest reporter for `@arizeai/phoenix-client/vitest`.
 *
 * The reporter does not replace Vitest's default test output. Instead it
 * appends a Phoenix-flavored summary at the end of the run that lists
 * outputs, annotations, and dataset/experiment links for each suite.
 *
 * The class implements the Vitest `Reporter` interface structurally rather
 * than nominally so we don't have to import a CJS type from `vitest/reporters`.
 */
export default class PhoenixVitestReporter {
  private hasPrinted = false;
  private runStartedAtMs = Date.now();

  // Clear the suite registry at the start of each run so suites from
  // previous watch-mode runs don't leak forward.
  onTestRunStart(): void {
    this.hasPrinted = false;
    this.runStartedAtMs = Date.now();
    clearAllSuites();
    clearSuiteSummaryArtifacts();
  }
  onTestRunEnd(): void {
    this.printSummaries();
  }
  // Vitest also calls `onFinished` on legacy reporters; alias for safety.
  onFinished(): void {
    this.printSummaries();
  }

  private printSummaries(): void {
    if (this.hasPrinted) return;
    const artifactSuites = readSuiteSummaryArtifacts({
      sinceMs: this.runStartedAtMs,
    });
    const suites = artifactSuites.length > 0 ? artifactSuites : getAllSuites();
    if (suites.length === 0) return;
    this.hasPrinted = true;
    printSuiteSummaries(suites);
  }
}

export { formatSuiteSummary, printSuiteSummaries };
