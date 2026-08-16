import { githubToken } from "./config.ts";
import type { GhComment, GhIssue, GhReaction } from "./types.ts";

const API = "https://api.github.com";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${githubToken()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gh-comment-watch",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run a GraphQL query (used for Discussions, which have no REST API). */
export async function graphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub GraphQL ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (body.errors?.length) {
    throw new Error(`GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  if (!body.data) {
    throw new Error("GraphQL: response did not include data.");
  }
  return body.data as T;
}

/** Fetch a single page, transparently waiting out primary rate limits. */
async function getPage(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: headers() });
    if (res.ok) return res;

    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = Number(res.headers.get("x-ratelimit-reset") ?? 0);
    if (
      (res.status === 403 || res.status === 429) &&
      remaining === "0" &&
      reset
    ) {
      const waitMs = Math.max(0, reset * 1000 - Date.now()) + 1000;
      await sleep(Math.min(waitMs, 60_000));
      continue;
    }
    if (res.status === 403 || res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 0);
      if (retryAfter > 0) {
        await sleep(Math.min(retryAfter * 1000, 60_000));
        continue;
      }
      const text = await res.text().catch(() => "");
      if (/secondary rate limit|abuse detection/i.test(text)) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new Error(`GitHub ${res.status} for ${url}: ${text.slice(0, 200)}`);
    }
    if (res.status >= 500) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status} for ${url}: ${text.slice(0, 200)}`);
  }
  throw new Error(`GitHub request gave up after retries: ${url}`);
}

/** Follow RFC 5988 Link headers until there are no more pages. */
async function paginate<T>(path: string): Promise<T[]> {
  let url: string | null = `${API}${path}`;
  const out: T[] = [];
  while (url) {
    const res = await getPage(url);
    out.push(...((await res.json()) as T[]));
    const link = res.headers.get("link") ?? "";
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return out;
}

/**
 * Issues and PRs, paginated by updated_at. `state` is "open" for a full
 * baseline scan or "all" for an incremental run (so we also see threads that
 * were just closed). `since` (ISO string) filters to threads updated on or
 * after it; omit it to fetch every matching thread regardless of age. (The
 * API rejects an epoch `since`, so a baseline must omit it, not fake an old
 * date.)
 */
export function listIssues(
  repo: string,
  since: string | null,
  state: "open" | "all" = "open"
): Promise<GhIssue[]> {
  const sinceParam = since ? `&since=${since}` : "";
  return paginate<GhIssue>(
    `/repos/${repo}/issues?state=${state}${sinceParam}&sort=updated&direction=desc&per_page=100`
  );
}

export function listComments(
  repo: string,
  issueNumber: number
): Promise<GhComment[]> {
  return paginate<GhComment>(
    `/repos/${repo}/issues/${issueNumber}/comments?per_page=100`
  );
}

/**
 * Every reaction on an issue/PR's opening post, each tagged with the user who
 * left it — so callers can exclude team/bot reactors. The aggregate `reactions`
 * summary on the issue object only has totals, not logins, hence this call.
 */
export function listIssueReactions(
  repo: string,
  issueNumber: number
): Promise<GhReaction[]> {
  return paginate<GhReaction>(
    `/repos/${repo}/issues/${issueNumber}/reactions?per_page=100`
  );
}

/**
 * Run an issue/PR search and return the matched threads as `{ repo, number }`.
 * Used for the personal queue (assignee / review-requested), which the issues
 * list can't express. Caps at GitHub's 1000-result search ceiling; that's far
 * beyond any one person's open queue.
 */
export async function searchIssues(
  q: string
): Promise<Array<{ repo: string; number: number }>> {
  const out: Array<{ repo: string; number: number }> = [];
  let url: string | null = `${API}/search/issues?q=${encodeURIComponent(
    q
  )}&per_page=100`;
  while (url) {
    const res = await getPage(url);
    const body = (await res.json()) as {
      items?: Array<{ number: number; repository_url: string }>;
    };
    for (const item of body.items ?? []) {
      // repository_url is ".../repos/<owner>/<repo>"; that suffix is our repo key.
      const repo = item.repository_url.replace(`${API}/repos/`, "");
      if (repo) out.push({ repo, number: item.number });
    }
    const link = res.headers.get("link") ?? "";
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return out;
}

/**
 * Is `login` a member of `org`? `true`/`false` when known, `null` when GitHub
 * won't say (e.g. the caller isn't an org member). Reliable as `false` only
 * because the authenticated user can see the org's private members too.
 */
export async function fetchOrgMembership(
  org: string,
  login: string
): Promise<boolean | null> {
  const res = await fetch(
    `${API}/orgs/${org}/members/${encodeURIComponent(login)}`,
    { headers: headers() }
  );
  if (res.status === 204) return true;
  if (res.status === 404) return false;
  return null; // 302 (caller not a member), 403 (rate limited), etc.
}
