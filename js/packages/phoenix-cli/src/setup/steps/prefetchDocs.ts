/**
 * Prefetch the Phoenix docs into the repo, so the instrumentation agent reads
 * package names and APIs from disk instead of fetching URLs mid-run.
 *
 * Runs only when instrumentation runs — the docs exist to serve the agent, so
 * a registration-only run has no reason to write them. Never fatal: a docs
 * site that is slow or down degrades to the agent fetching pages itself, which
 * is what it did before this step existed.
 *
 * Must run after the git-safety gate: the download writes untracked files
 * under `.px/`, which a fast headless run could otherwise mistake for
 * pre-existing user changes.
 */

import * as COPY from "../copy";
import {
  unknownWorkflowWarning,
  type DocsPrefetchOptions,
  type DocsPrefetchResult,
  type SetupDeps,
} from "../deps";
import { ensureGitignored } from "../util/gitignoreCoverage";

/** The docs land under `.px/`, so that is what gets gitignored. */
const DOCS_GITIGNORE_ENTRY = ".px/";

/**
 * Download the docs and gitignore what they wrote. A failure is reported and
 * dropped: the connection and hand-off files are real work worth keeping, and
 * the agent can still read the docs from the web.
 */
export async function prefetchDocs(
  deps: Pick<SetupDeps, "fetchDocs" | "prompter" | "context">,
  {
    docs,
    isGitRepository,
  }: { docs: DocsPrefetchOptions; isGitRepository: boolean }
): Promise<DocsPrefetchResult | undefined> {
  if (!docs.enabled) {
    return undefined;
  }
  deps.prompter.line(COPY.DOCS_PREFETCH.fetching);
  try {
    const result = await deps.fetchDocs(docs);
    // A typo'd --workflow filters silently, so name it — otherwise the run
    // reports "0 pages" with no hint the workflow value was the problem.
    for (const workflow of result.unknownWorkflows ?? []) {
      deps.prompter.line(unknownWorkflowWarning(workflow));
    }
    const { appended } = ensureGitignored({
      directory: deps.context.cwd,
      filenames: [DOCS_GITIGNORE_ENTRY],
      isGitRepository,
    });
    deps.prompter.line(
      COPY.DOCS_PREFETCH.wrote(result.written, result.outputDir)
    );
    return { ...result, gitignoreAppended: appended };
  } catch (error) {
    deps.prompter.line(
      COPY.DOCS_PREFETCH.failed(
        error instanceof Error ? error.message : String(error)
      )
    );
    return undefined;
  }
}
