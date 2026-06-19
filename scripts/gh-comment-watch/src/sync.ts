import {
  CONCURRENCY,
  FULL_SYNC_INTERVAL_HOURS,
  REPOS,
  SYNC_OVERLAP_MINUTES,
  VIEWER,
} from "./config.ts";
import {
  counts,
  deleteItem,
  getMeta,
  pruneItems,
  setMeta,
  setPersonalFlags,
  upsertItem,
} from "./db.ts";
import { fetchDiscussions, triageDiscussion } from "./discussions.ts";
import {
  listComments,
  listIssueReactions,
  listIssues,
  searchIssues,
} from "./github.ts";
import { isOrgMember } from "./membership.ts";
import { teamSet } from "./team.ts";
import {
  orgMemberFlag,
  tallyReactions,
  verdict,
  verdictFields,
  type Entry,
} from "./triage.ts";
import type { GhIssue, ItemInput, SyncStatus, ThreadType } from "./types.ts";

const status: SyncStatus = {
  running: false,
  total: 0,
  done: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
  needsAttention: 0,
};

export function getStatus(): SyncStatus {
  return { ...status, needsAttention: counts().needs };
}

async function triageIssue(
  repo: string,
  issue: GhIssue,
  team: Set<string>,
  syncedAt: string
): Promise<ItemInput> {
  const type: ThreadType = issue.pull_request ? "pr" : "issue";

  const entries: Entry[] = [
    {
      kind: "body",
      login: issue.user?.login ?? null,
      user: issue.user,
      created_at: issue.created_at,
      url: issue.html_url,
      body: issue.body ?? "",
    },
  ];

  if (issue.comments > 0) {
    const comments = await listComments(repo, issue.number);
    for (const c of comments) {
      entries.push({
        kind: "comment",
        login: c.user?.login ?? null,
        user: c.user,
        created_at: c.created_at,
        url: c.html_url,
        body: c.body ?? "",
      });
    }
  }

  // Reactions on the opening post signal demand, but only count outside users.
  // Skip the extra request when GitHub's summary says there are none.
  let reactions: Record<string, number> = {};
  if ((issue.reactions?.total_count ?? 0) > 0) {
    const reactors = await listIssueReactions(repo, issue.number);
    reactions = tallyReactions(
      reactors.map((r) => ({
        key: r.content,
        login: r.user?.login ?? null,
        user: r.user,
      })),
      team
    );
  }

  const v = verdict(entries, team);
  const orgMember = await orgMemberFlag(v, isOrgMember);
  return {
    repo,
    number: issue.number,
    type,
    title: issue.title,
    html_url: issue.html_url,
    author: issue.user?.login ?? null,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    labels: (issue.labels ?? []).map((l) => l.name),
    reactions,
    has_assignee: (issue.assignees?.length ?? 0) > 0,
    ...verdictFields(v, orgMember, syncedAt),
  };
}

/** Run `worker` over `items` with a bounded number in flight. */
async function pool<Result>(
  items: Result[],
  limit: number,
  worker: (item: Result) => Promise<void>
) {
  let i = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        await worker(items[idx]);
      }
    }
  );
  await Promise.all(runners);
}

/** Max of two ISO-8601 UTC timestamps (lexicographic order works for them). */
function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/** The ISO timestamp `minutes` before `iso`. */
function isoMinus(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) - minutes * 60_000).toISOString();
}

/**
 * Refresh the personal-queue flags from a fresh search: which open threads are
 * directly assigned to the viewer, and which PRs have a review personally
 * requested from them — scoped to the monitored repos. Two calls regardless of
 * repo count. `user-review-requested` (not `review-requested`) excludes
 * team-routed requests, so only the viewer personally counts.
 */
async function syncPersonal(): Promise<void> {
  const repoQ = REPOS.map((r) => `repo:${r}`).join(" ");
  const assigned = await searchIssues(`is:open assignee:${VIEWER} ${repoQ}`);
  const review = await searchIssues(
    `is:open user-review-requested:${VIEWER} ${repoQ}`
  );
  setPersonalFlags(assigned, review);
}

function isFullSyncDue(now: number): boolean {
  if (FULL_SYNC_INTERVAL_HOURS === 0) return false;
  const lastFullSync = getMeta("last_full_sync_at");
  if (!lastFullSync) return true;
  const lastFullSyncMs = Date.parse(lastFullSync);
  if (!Number.isFinite(lastFullSyncMs)) return true;
  return now - lastFullSyncMs >= FULL_SYNC_INTERVAL_HOURS * 60 * 60_000;
}

/**
 * Sync GitHub into the local DB: issues, PRs, and discussions.
 *
 * - **Baseline** (first run / empty DB / `full` / periodic): scan *all open*
 *   threads regardless of age, then prune anything not seen. No activity window
 *   — a thread ignored for a year is exactly what this tool exists to surface,
 *   so it must never age out.
 * - **Incremental** (regular timer): only pull threads updated since our
 *   cursor, to stay cheap. Fetches closed ones too so we can drop them.
 *   Untouched older rows are left in place, not pruned.
 *
 * The cursor is a **data watermark**, not wall-clock time: per repo and kind we
 * remember the newest `updated_at` we've actually ingested, and ask GitHub only
 * for threads updated since `watermark - overlap`. Because the watermark never
 * moves past data we haven't seen, an update that's briefly missing from
 * GitHub's `since` index can't slip behind the cursor — the next sync still
 * catches it. (A wall-clock cursor would jump to "now" and strand it until the
 * next baseline.) The small overlap only has to cover GitHub's index reordering
 * window, and both sides of the comparison use GitHub's own timestamps.
 */
export async function runSync({ full = false } = {}): Promise<SyncStatus> {
  if (status.running) return getStatus();
  status.running = true;
  status.error = null;
  status.done = 0;
  status.total = 0;
  const startedAt = new Date().toISOString();
  status.startedAt = startedAt;
  status.finishedAt = null;

  try {
    const team = teamSet();

    const haveCursors = REPOS.some(
      (r) => getMeta(`wm_issues:${r}`) || getMeta(`wm_disc:${r}`)
    );
    const baseline =
      full ||
      !haveCursors ||
      counts().tracked === 0 ||
      isFullSyncDue(Date.now());

    const syncedAt = new Date().toISOString();
    // Watermarks to commit at the end (only on a clean run). Each is the newest
    // updated_at we saw for that repo/kind this run, never regressing below the
    // stored value.
    const nextWatermarks: Array<[string, string | null]> = [];

    for (const repo of REPOS) {
      // --- Issues & PRs (REST) ---
      const wmIssues = baseline ? null : getMeta(`wm_issues:${repo}`);
      const sinceIssues = wmIssues
        ? isoMinus(wmIssues, SYNC_OVERLAP_MINUTES)
        : null;
      // With a cursor we ask for "all" so just-closed threads come back and can
      // be dropped; a cursorless (baseline) scan only needs the open set.
      const issues = await listIssues(
        repo,
        sinceIssues,
        sinceIssues ? "all" : "open"
      );
      status.total += issues.length;

      let maxIssues = wmIssues;
      await pool(issues, CONCURRENCY, async (issue) => {
        try {
          // Advance the watermark for everything we see, including closures.
          maxIssues = maxIso(maxIssues, issue.updated_at);
          if (issue.state !== "open") {
            // closed/merged since last sync
            deleteItem(repo, issue.pull_request ? "pr" : "issue", issue.number);
            return;
          }
          upsertItem(await triageIssue(repo, issue, team, syncedAt));
        } finally {
          status.done++;
        }
      });
      nextWatermarks.push([`wm_issues:${repo}`, maxIssues]);

      // --- Discussions (GraphQL) — best-effort so a GraphQL hiccup on one repo
      // doesn't lose the issue results we just wrote. Repos with discussions
      // disabled simply return none. ---
      try {
        const wmDisc = baseline ? null : getMeta(`wm_disc:${repo}`);
        const sinceDisc = wmDisc
          ? isoMinus(wmDisc, SYNC_OVERLAP_MINUTES)
          : null;
        const discussions = await fetchDiscussions(repo, sinceDisc);
        status.total += discussions.length;

        let maxDisc = wmDisc;
        await pool(discussions, CONCURRENCY, async (d) => {
          try {
            maxDisc = maxIso(maxDisc, d.updatedAt);
            if (d.closed) {
              deleteItem(repo, "discussion", d.number);
              return;
            }
            upsertItem(await triageDiscussion(repo, d, team, syncedAt));
          } finally {
            status.done++;
          }
        });
        nextWatermarks.push([`wm_disc:${repo}`, maxDisc]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        status.error = `discussions (${repo}): ${msg}`;
      }
    }

    // Refresh the personal queue (assigned / review-requested). Independent of
    // the triage cursor — it's a fresh full picture each run — so skip it if the
    // triage pass already failed rather than acting on partial data.
    if (!status.error) {
      try {
        await syncPersonal();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        status.error = `personal queue: ${msg}`;
      }
    }

    // Commit only on a clean run, so a partial failure doesn't move the cursor
    // past threads it never processed. A baseline saw every open thread, so
    // anything not re-seen is gone (closed/transferred) and is pruned;
    // incremental only touched what changed, so it must NOT prune.
    if (!status.error) {
      if (baseline) pruneItems(syncedAt);
      for (const [key, value] of nextWatermarks) {
        if (value) setMeta(key, value);
      }
      setMeta("last_sync_at", startedAt); // display only; the cursor is the watermarks
      setMeta("last_sync_mode", baseline ? "baseline" : "incremental");
      if (baseline) setMeta("last_full_sync_at", startedAt);
    }
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err);
  } finally {
    status.running = false;
    status.finishedAt = new Date().toISOString();
  }
  return getStatus();
}
