import {
  clearSuiteSummaryArtifacts,
  readSuiteSummaryArtifacts,
} from "../testing/report-artifacts";
import { printSuiteSummaries } from "../testing/reporter-format";
import { clearAllSuites, getAllSuites } from "../testing/runner";

/**
 * Jest reporter for `@arizeai/phoenix-client/jest`.
 *
 * Like the Vitest reporter, this does not replace Jest's default output. It
 * appends a Phoenix summary block at the end of the run.
 */
export default class PhoenixJestReporter {
  private hasPrinted = false;
  private runStartedAtMs = Date.now();

  // jest passes globalConfig + reporterOptions; we ignore both
  constructor(_globalConfig?: unknown, _reporterOptions?: unknown) {}

  // Clear the suite registry at the start of each run so suites from a
  // previous --watch invocation don't leak forward.
  onRunStart(): void {
    this.hasPrinted = false;
    this.runStartedAtMs = Date.now();
    clearAllSuites();
    clearSuiteSummaryArtifacts();
  }

  onRunComplete(): void {
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
