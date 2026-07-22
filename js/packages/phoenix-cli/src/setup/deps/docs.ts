/**
 * The docs-prefetch capability: the network+fs seam for the docs step.
 */

import { existsSync, readdirSync } from "node:fs";

import {
  DEFAULT_OUTPUT_DIR,
  DEFAULT_WORKERS,
  downloadDocs,
  fetchDocsIndex,
  filterByWorkflows,
  resolveWorkflows,
} from "../../commands/docs";

// This module is setup's only door onto the docs command, so the warning the
// prefetch step prints for a bad `--workflow` comes through here rather than
// the step reaching into `commands/` for it.
export { unknownWorkflowWarning } from "../../commands/docs";

export interface DocsPrefetchOptions {
  /** --no-docs turns the prefetch off; it is on by default. */
  enabled: boolean;
  /** --workflow: repeatable workflow filter; defaults to the docs defaults. */
  workflows?: string[];
  /** --refresh-docs: clear the output directory before downloading. */
  refresh?: boolean;
  /** --workers: concurrent downloads. */
  workers?: number;
}

/** What the docs prefetch actually wrote — reported in the setup summary. */
export interface DocsPrefetchResult {
  outputDir: string;
  workflows: string[];
  written: number;
  /** Pages the docs site did not serve; the agent falls back to the web for these. */
  failed: number;
  /** Paths the step appended to a .gitignore, folded into the setup report. */
  gitignoreAppended?: string[];
  /** `--workflow` names that aren't recognized — surfaced as a warning. */
  unknownWorkflows?: string[];
  /**
   * Whether the docs directory holds pages the agent can read — which is not
   * the same as `written > 0`. A re-run whose downloads all fail still leaves
   * the previous run's tree in place, and the agent should be pointed at that
   * rather than back at a docs site that has just failed us.
   */
  hasPagesOnDisk: boolean;
}

export type DocsFetcher = (
  options: DocsPrefetchOptions
) => Promise<DocsPrefetchResult>;

/**
 * Download the docs the same way `px docs fetch` does, into the same
 * `.px/docs` directory, so a user who later runs the command by hand refreshes
 * the tree setup already laid down.
 */
export async function fetchDocs(
  options: DocsPrefetchOptions
): Promise<DocsPrefetchResult> {
  const { workflows, unknown } = resolveWorkflows(options.workflows);
  const entries = filterByWorkflows(await fetchDocsIndex(), workflows);
  const outputDir = DEFAULT_OUTPUT_DIR;
  const { succeeded, failed } = await downloadDocs(entries, {
    outputDir,
    workers: options.workers ?? DEFAULT_WORKERS,
    refresh: options.refresh,
  });
  return {
    outputDir,
    workflows,
    written: succeeded.length,
    failed: failed.length,
    unknownWorkflows: unknown,
    hasPagesOnDisk: existsSync(outputDir) && readdirSync(outputDir).length > 0,
  };
}
