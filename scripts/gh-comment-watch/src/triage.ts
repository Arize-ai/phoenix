import type { GhUser } from "./types.ts";

/**
 * One entry in a thread's conversation: the opening post, a comment, or (for
 * discussions) a threaded reply. Shared by the issue/PR and discussion paths.
 */
export interface Entry {
  kind: "body" | "comment" | "reply";
  login: string | null;
  user: GhUser | null;
  created_at: string;
  url: string;
  body: string;
}

export function isBot(user: GhUser | null): boolean {
  if (!user) return true;
  return user.type === "Bot" || /\[bot\]$/i.test(user.login);
}

/** Is this login on the team allowlist? Case-insensitive; null → false. */
export function isTeam(login: string | null, team: Set<string>): boolean {
  return team.has((login ?? "").toLowerCase());
}

/**
 * Whether a reactor counts toward "outside demand": not us, not a bot.
 * Excludes team members and bots — dosubot reacts as `dosubot[bot]` (caught by
 * `isBot`), with a bare `dosubot` login guarded as a fallback.
 */
export function isOutsideReactor(
  login: string | null,
  user: GhUser | null,
  team: Set<string>
): boolean {
  if (!login) return false;
  if (isTeam(login, team)) return false;
  if (isBot(user)) return false;
  if (login.toLowerCase() === "dosubot") return false;
  return true;
}

/** GraphQL ReactionContent enum → the REST reaction keys we store. */
const GQL_REACTION_KEY: Record<string, string> = {
  THUMBS_UP: "+1",
  THUMBS_DOWN: "-1",
  LAUGH: "laugh",
  HOORAY: "hooray",
  CONFUSED: "confused",
  HEART: "heart",
  ROCKET: "rocket",
  EYES: "eyes",
};

export function gqlReactionKey(content: string): string | undefined {
  return GQL_REACTION_KEY[content];
}

/**
 * Tally reactions by emoji key, counting only outside reactors. Returns a map
 * (e.g. `{"+1":4}`), empty when nobody outside the team has reacted.
 */
export function tallyReactions(
  reactors: Array<{ key: string; login: string | null; user: GhUser | null }>,
  team: Set<string>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of reactors) {
    if (!r.key) continue;
    if (!isOutsideReactor(r.login, r.user, team)) continue;
    counts[r.key] = (counts[r.key] ?? 0) + 1;
  }
  return counts;
}

export function excerpt(body: string): string {
  return body.replace(/\r/g, "").trim().slice(0, 500);
}

export interface Verdict {
  needs: boolean;
  reason: string;
  lastIsTeam: number;
  display: Entry;
}

/**
 * Decide whether a thread needs attention by looking at who spoke last.
 *
 * Bots are ignored. The last *human* entry wins: if a team member posted it
 * we're done; otherwise it's awaiting a reply. Pure and synchronous — the
 * org-membership enrichment is a separate, IO-bound concern (`orgMemberFlag`).
 */
export function verdict(entries: Entry[], team: Set<string>): Verdict {
  // Sort by time so threaded replies interleave correctly with comments.
  const ordered = [...entries].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );
  const human = ordered.filter((e) => !isBot(e.user));
  const last = human[human.length - 1];

  let needs = false;
  let reason: string;
  let lastIsTeam = 0;

  if (!last) {
    reason = "Only bot activity";
  } else if (isTeam(last.login, team)) {
    lastIsTeam = 1;
    reason = "Team posted last";
  } else {
    needs = true;
    reason =
      last.kind === "body" ? "Opened, no team response" : "Awaiting reply";
  }

  const display = last ?? ordered[ordered.length - 1];
  return { needs, reason, lastIsTeam, display };
}

/**
 * Does the displayed actor look like an org member who isn't on the team
 * allowlist — a colleague off the on-call list? Skipped for team/bot actors.
 * The lookup is passed in (the sync path supplies the cached `isOrgMember`),
 * which also keeps this module free of any DB/network import so it stays
 * unit-testable in isolation.
 */
export async function orgMemberFlag(
  v: Verdict,
  checkOrgMember: (login: string, now: number) => Promise<boolean>
): Promise<boolean> {
  if (!v.display.login || v.lastIsTeam || isBot(v.display.user)) return false;
  return checkOrgMember(v.display.login, Date.now());
}

/**
 * The triage-derived columns shared by issues, PRs, and discussions. Both sync
 * paths assemble the same tail from a verdict; only the identity fields (repo,
 * number, title, timestamps, …) differ between them.
 */
export function verdictFields(
  v: Verdict,
  orgMember: boolean,
  syncedAt: string
) {
  return {
    needs_attention: v.needs,
    reason: v.reason,
    last_actor: v.display.login,
    last_actor_is_bot: isBot(v.display.user),
    last_actor_is_org_member: orgMember,
    last_entry_at: v.display.created_at,
    last_entry_url: v.display.url,
    last_entry_excerpt: excerpt(v.display.body),
    synced_at: syncedAt,
  };
}
