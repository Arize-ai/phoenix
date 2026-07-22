/**
 * Confirm git can undo whatever setup is about to do.
 *
 * A coding agent may be about to edit files in this directory; git is the
 * undo button. Both gates are opt-in selects with the safe option first.
 * Headless mode proceeds only on a clean repo.
 */

import * as COPY from "../copy";
import type { SetupDeps } from "../deps";
import { SetupFatalError } from "../errors";
import { selectBoolean } from "../ui/selectBoolean";

export interface GitSafetyResult {
  isGitRepository: boolean;
  /** False when the user chose to stop at a gate. */
  proceed: boolean;
}

const MAX_LISTED_FILES = 20;

export async function confirmGitSafety(
  deps: Pick<SetupDeps, "context" | "processes" | "prompter">,
  { headless }: { headless: boolean }
): Promise<GitSafetyResult> {
  const repoCheck = await deps.processes.exec({
    command: "git",
    args: ["rev-parse", "--is-inside-work-tree"],
    cwd: deps.context.cwd,
  });
  const isGitRepository =
    repoCheck.exitCode === 0 && repoCheck.stdout.trim() === "true";

  if (!isGitRepository) {
    // `git` missing entirely is treated the same as "not a repo".
    if (headless) {
      throw new SetupFatalError(COPY.GIT.headlessNotARepo);
    }
    const proceed = await selectBoolean({
      prompter: deps.prompter,
      message: COPY.GIT.notARepoMessage,
      noFirst: true,
      noLabel: COPY.GIT.notARepoNo,
      noHint: COPY.GIT.notARepoNoHint,
      yesLabel: COPY.GIT.notARepoYes,
      yesHint: COPY.GIT.notARepoYesHint,
    });
    if (!proceed) {
      deps.prompter.line(COPY.GIT.stopped);
    }
    return { isGitRepository, proceed };
  }

  const statusCheck = await deps.processes.exec({
    command: "git",
    args: ["status", "--porcelain=v1"],
    cwd: deps.context.cwd,
  });
  const dirtyPaths = statusCheck.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (dirtyPaths.length === 0) {
    return { isGitRepository, proceed: true };
  }

  if (headless) {
    throw new SetupFatalError(COPY.GIT.headlessDirty);
  }

  const shown = dirtyPaths.slice(0, MAX_LISTED_FILES);
  const lines = [...shown];
  if (dirtyPaths.length > MAX_LISTED_FILES) {
    lines.push(COPY.GIT.andMore(dirtyPaths.length - MAX_LISTED_FILES));
  }
  deps.prompter.note(lines.join("\n"), COPY.GIT.dirtyFileListTitle);

  const proceed = await selectBoolean({
    prompter: deps.prompter,
    message: COPY.GIT.dirtyMessage(dirtyPaths.length),
    noFirst: true,
    noLabel: COPY.GIT.dirtyNo,
    noHint: COPY.GIT.dirtyNoHint,
    yesLabel: COPY.GIT.dirtyYes,
    yesHint: COPY.GIT.dirtyYesHint,
  });
  if (!proceed) {
    deps.prompter.line(COPY.GIT.stopped);
  }
  return { isGitRepository, proceed };
}
