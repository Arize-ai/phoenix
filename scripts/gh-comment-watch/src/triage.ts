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
  } else if (team.has((last.login ?? "").toLowerCase())) {
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
): Promise<number> {
  if (!v.display.login || v.lastIsTeam || isBot(v.display.user)) return 0;
  return (await checkOrgMember(v.display.login, Date.now())) ? 1 : 0;
}

/**
 * The triage-derived columns shared by issues, PRs, and discussions. Both
 * sync paths assemble the same tail from a verdict; only the identity fields
 * (uid, title, timestamps, …) differ between them.
 */
export function verdictFields(v: Verdict, orgMember: number, syncedAt: string) {
  return {
    needs_attention: v.needs ? 1 : 0,
    reason: v.reason,
    last_actor: v.display.login,
    last_actor_is_team: v.lastIsTeam,
    last_actor_is_bot: isBot(v.display.user) ? 1 : 0,
    last_actor_is_org_member: orgMember,
    last_entry_at: v.display.created_at,
    last_entry_url: v.display.url,
    last_entry_excerpt: excerpt(v.display.body),
    last_entry_kind: v.display.kind,
    synced_at: syncedAt,
  };
}
