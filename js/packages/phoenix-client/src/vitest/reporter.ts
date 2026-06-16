import { SuiteSummaryReportRun } from "../testing/report-run";
import {
  formatSuiteSummary,
  printSuiteSummaries,
} from "../testing/reporter-format";

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
  private readonly report = new SuiteSummaryReportRun();

  onTestRunStart(): void {
    this.report.begin();
  }
  onTestRunEnd(): void {
    this.report.finish();
  }
  // Vitest also calls `onFinished` on legacy reporters; alias for safety.
  onFinished(): void {
    this.report.finish();
  }
}

export { formatSuiteSummary, printSuiteSummaries };
