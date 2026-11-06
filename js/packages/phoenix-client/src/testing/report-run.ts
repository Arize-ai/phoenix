import {
  clearSuiteSummaryArtifacts,
  readSuiteSummaryArtifacts,
} from "./report-artifacts";
import { printSuiteSummaries } from "./reporter-format";
import { clearAllSuites, getAllSuites } from "./runner";

/**
 * Shared "print the Phoenix summary once per run" policy for the jest and
 * vitest reporters. The two frameworks differ only in which lifecycle methods
 * they call; both delegate to {@link begin} on run start and {@link finish}
 * on run end.
 */
export class SuiteSummaryReportRun {
  private hasPrinted = false;
  private runStartedAtMs = 0;

  /**
   * Reset state at the start of a run so suites/artifacts from a previous
   * watch-mode invocation don't leak forward.
   */
  begin(): void {
    this.hasPrinted = false;
    this.runStartedAtMs = Date.now();
    clearAllSuites();
    clearSuiteSummaryArtifacts();
  }

  /**
   * Print the Phoenix summary once. Prefers the on-disk artifacts written by
   * suite workers, falling back to the in-process registry. A no-op once the
   * summary has already been printed for this run.
   */
  finish(): void {
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
