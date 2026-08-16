import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

/**
 * The "owner/repo" repos this tool monitors. Override with REPOS (comma- or
 * space-separated), e.g. REPOS="Arize-ai/phoenix,Arize-ai/openinference".
 */
export const REPOS: string[] = (
  process.env.REPOS ??
  process.env.REPO ??
  "Arize-ai/phoenix,Arize-ai/openinference"
)
  .split(/[\s,]+/)
  .map((r) => r.trim())
  .filter(Boolean);

if (REPOS.length === 0) {
  throw new Error("REPOS must include at least one owner/repo value.");
}

for (const repo of REPOS) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error(`Invalid repo "${repo}". Expected owner/repo.`);
  }
}

/**
 * Org used to check membership badges. Membership is org-scoped, so multi-repo
 * monitoring assumes all repos share this org.
 */
export const SEED_ORG = process.env.SEED_ORG ?? REPOS[0].split("/")[0];

/**
 * Whose personal queue ("assigned to me" / "review requested from me") to
 * track. Defaults to `@me` — the user behind the `gh` token. Set VIEWER to a
 * literal login to watch someone else's queue instead.
 */
export const VIEWER = process.env.VIEWER?.trim() || "@me";

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function nonNegativeNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return value;
}

export const PORT = positiveIntegerEnv("PORT", 58736);

/**
 * Local persistent SQLite cache. Kept under the user's home dir (outside the
 * repo) so it survives `git clean`, isn't repo-relative, and can be shared
 * across checkouts. Override with DB_FILE_NAME.
 */
export const DB_FILE_NAME =
  process.env.DB_FILE_NAME ??
  path.join(os.homedir(), ".phoenix", ".gh-comment-watch", "local.db");

/** Concurrent GitHub fetches during a sync. */
export const CONCURRENCY = positiveIntegerEnv("CONCURRENCY", 8);

/** How often the server auto-syncs in the background. 0 disables the timer. */
export const SYNC_INTERVAL_MINUTES = nonNegativeNumberEnv(
  "SYNC_INTERVAL_MINUTES",
  15
);

/**
 * Incremental syncs are cheap, but a periodic full scan prevents closed threads
 * missed during downtime from lingering forever. 0 disables periodic baselines.
 */
export const FULL_SYNC_INTERVAL_HOURS = nonNegativeNumberEnv(
  "FULL_SYNC_INTERVAL_HOURS",
  24
);

/**
 * Incremental syncs look back a little past the last sync time so edits made
 * mid-sync aren't missed (GitHub's `since` is by updated_at, second-precision).
 */
export const SYNC_OVERLAP_MINUTES = nonNegativeNumberEnv(
  "SYNC_OVERLAP_MINUTES",
  10
);

let cachedToken: string | undefined;

/**
 * Reuse the `gh` CLI's credentials so on-call engineers don't manage a
 * separate token. Falls back to GITHUB_TOKEN if the CLI isn't available.
 */
export function githubToken(): string {
  if (cachedToken) return cachedToken;
  if (process.env.GITHUB_TOKEN) {
    cachedToken = process.env.GITHUB_TOKEN;
    return cachedToken;
  }
  try {
    cachedToken = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
    }).trim();
  } catch {
    throw new Error(
      "No GitHub credentials. Run `gh auth login` (preferred) or set GITHUB_TOKEN."
    );
  }
  if (!cachedToken) throw new Error("`gh auth token` returned an empty token.");
  return cachedToken;
}
