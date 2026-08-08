/**
 * Gitignore coverage check + banner append for setup's hand-off files.
 *
 * Coverage is evaluated with the `ignore` package against the existing
 * patterns — never a naive substring search — so a pattern like `.env*`
 * already covers `.env.phoenix` and nothing is appended.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import ignore from "ignore";

export const GITIGNORE_BANNER =
  "# Added by px setup — local Phoenix credentials";

export interface EnsureGitignoredArgs {
  /** Directory containing (or to contain) the .gitignore file. */
  directory: string;
  /** Bare filenames (relative to `directory`) that must be ignored. */
  filenames: string[];
  /** When false (not a git repo), no .gitignore is created or modified. */
  isGitRepository: boolean;
}

export interface EnsureGitignoredResult {
  /** Names that were appended (empty when everything was already covered). */
  appended: string[];
  /** Path to the .gitignore that was modified, when a write happened. */
  gitignorePath?: string;
}

export function ensureGitignored({
  directory,
  filenames,
  isGitRepository,
}: EnsureGitignoredArgs): EnsureGitignoredResult {
  const gitignorePath = path.join(directory, ".gitignore");
  const exists = fs.existsSync(gitignorePath);

  // No .gitignore and not a repo → skip silently.
  if (!exists && !isGitRepository) {
    return { appended: [] };
  }

  const existingContent = exists ? fs.readFileSync(gitignorePath, "utf-8") : "";

  const matcher = ignore().add(existingContent);
  const uncovered = filenames.filter((name) => !matcher.ignores(name));
  if (uncovered.length === 0) {
    return { appended: [] };
  }

  const banner = [GITIGNORE_BANNER, ...uncovered].join("\n");

  let updated: string;
  if (existingContent === "") {
    updated = `${banner}\n`;
  } else if (existingContent.endsWith("\n")) {
    updated = `${existingContent}\n${banner}\n`;
  } else {
    // File didn't end with a newline — terminate the last line, then a
    // blank separator line before the banner.
    updated = `${existingContent}\n\n${banner}\n`;
  }

  // Exactly one trailing newline.
  updated = `${updated.replace(/\n+$/, "")}\n`;

  fs.writeFileSync(gitignorePath, updated, "utf-8");
  return { appended: uncovered, gitignorePath };
}
