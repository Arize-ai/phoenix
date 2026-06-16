import { SuiteSummaryReportRun } from "../testing/report-run";

/**
 * Jest reporter for `@arizeai/phoenix-client/jest`.
 *
 * Like the Vitest reporter, this does not replace Jest's default output. It
 * appends a Phoenix summary block at the end of the run.
 */
export default class PhoenixJestReporter {
  private readonly report = new SuiteSummaryReportRun();

  // jest passes globalConfig + reporterOptions; we ignore both
  constructor(_globalConfig?: unknown, _reporterOptions?: unknown) {}

  onRunStart(): void {
    this.report.begin();
  }

  onRunComplete(): void {
    this.report.finish();
  }
}
