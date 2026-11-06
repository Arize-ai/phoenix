import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { DB_FILE_NAME } from "./config.ts";
import {
  itemLabels,
  itemReactions,
  items,
  meta,
  orgMembershipCache,
  teamMembers,
} from "./schema.ts";
import type { ItemInput, ItemView, ThreadType } from "./types.ts";

fs.mkdirSync(path.dirname(DB_FILE_NAME), { recursive: true });

const sqlite = new Database(DB_FILE_NAME);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle({
  client: sqlite,
  schema: {
    items,
    itemLabels,
    itemReactions,
    teamMembers,
    orgMembershipCache,
    meta,
  },
});

/** Replace the team allowlist (logins stored lowercased for case-insensitive joins). */
export function seedTeamMembers(logins: Iterable<string>): void {
  db.transaction((tx) => {
    tx.delete(teamMembers).run();
    const rows = [...new Set([...logins].map((l) => l.toLowerCase()))].map(
      (login) => ({ login })
    );
    if (rows.length) tx.insert(teamMembers).values(rows).run();
  });
}

/**
 * Insert or update a thread and replace its labels/reactions in one transaction.
 * The personal-queue flags (`assigned_to_me`, `review_requested_from_me`) are
 * owned by `setPersonalFlags`, so they're set only on insert and preserved on
 * conflict.
 */
export function upsertItem(input: ItemInput): void {
  db.transaction((tx) => {
    const row = tx
      .insert(items)
      .values({
        repo: input.repo,
        type: input.type,
        number: input.number,
        title: input.title,
        html_url: input.html_url,
        author: input.author,
        created_at: input.created_at,
        updated_at: input.updated_at,
        needs_attention: input.needs_attention,
        reason: input.reason,
        last_actor: input.last_actor,
        last_actor_is_bot: input.last_actor_is_bot,
        last_actor_is_org_member: input.last_actor_is_org_member,
        last_entry_at: input.last_entry_at,
        last_entry_url: input.last_entry_url,
        last_entry_excerpt: input.last_entry_excerpt,
        has_assignee: input.has_assignee,
        assigned_to_me: false,
        review_requested_from_me: false,
        synced_at: input.synced_at,
      })
      .onConflictDoUpdate({
        target: [items.repo, items.type, items.number],
        set: {
          title: input.title,
          html_url: input.html_url,
          author: input.author,
          created_at: input.created_at,
          updated_at: input.updated_at,
          needs_attention: input.needs_attention,
          reason: input.reason,
          last_actor: input.last_actor,
          last_actor_is_bot: input.last_actor_is_bot,
          last_actor_is_org_member: input.last_actor_is_org_member,
          last_entry_at: input.last_entry_at,
          last_entry_url: input.last_entry_url,
          last_entry_excerpt: input.last_entry_excerpt,
          has_assignee: input.has_assignee,
          synced_at: input.synced_at,
        },
      })
      .returning({ id: items.id })
      .get();

    const id = row.id;
    tx.delete(itemLabels).where(eq(itemLabels.item_id, id)).run();
    const labelRows = [...new Set(input.labels)].map((label) => ({
      item_id: id,
      label,
    }));
    if (labelRows.length) tx.insert(itemLabels).values(labelRows).run();

    tx.delete(itemReactions).where(eq(itemReactions.item_id, id)).run();
    const reactionRows = Object.entries(input.reactions)
      .filter(([, n]) => n > 0)
      .map(([emoji, n]) => ({ item_id: id, emoji, count: n }));
    if (reactionRows.length)
      tx.insert(itemReactions).values(reactionRows).run();
  });
}

/**
 * Drop rows not touched by a full baseline sync (closed or aged out). Child
 * rows go with them via ON DELETE CASCADE.
 */
export function pruneItems(syncedAt: string): void {
  db.delete(items)
    .where(sql`${items.synced_at} < ${syncedAt}`)
    .run();
}

/** Remove a single tracked thread by its natural key (e.g. it was just closed). */
export function deleteItem(
  repo: string,
  type: ThreadType,
  number: number
): void {
  db.delete(items)
    .where(
      and(eq(items.repo, repo), eq(items.type, type), eq(items.number, number))
    )
    .run();
}

/**
 * Replace the personal-queue flags wholesale from the latest search results:
 * clear everything, then mark the matching issues/PRs. Matched by (repo, number)
 * — unique across issues and PRs — restricted to non-discussion rows. One
 * transaction so a reader never sees a half-cleared state.
 */
export function setPersonalFlags(
  assigned: Array<{ repo: string; number: number }>,
  review: Array<{ repo: string; number: number }>
): void {
  const issueLike = inArray(items.type, ["issue", "pr"]);
  db.transaction((tx) => {
    tx.update(items)
      .set({ assigned_to_me: false, review_requested_from_me: false })
      .run();
    for (const { repo, number } of assigned) {
      tx.update(items)
        .set({ assigned_to_me: true })
        .where(and(eq(items.repo, repo), eq(items.number, number), issueLike))
        .run();
    }
    for (const { repo, number } of review) {
      tx.update(items)
        .set({ review_requested_from_me: true })
        .where(and(eq(items.repo, repo), eq(items.number, number), issueLike))
        .run();
    }
  });
}

export function getCachedMembership(
  login: string
): { is_member: boolean; checked_at: string } | undefined {
  return db
    .select({
      is_member: orgMembershipCache.is_member,
      checked_at: orgMembershipCache.checked_at,
    })
    .from(orgMembershipCache)
    .where(eq(orgMembershipCache.login, login.toLowerCase()))
    .get();
}

export function setCachedMembership(
  login: string,
  isMember: boolean,
  checkedAt: string
): void {
  db.insert(orgMembershipCache)
    .values({
      login: login.toLowerCase(),
      is_member: isMember,
      checked_at: checkedAt,
    })
    .onConflictDoUpdate({
      target: orgMembershipCache.login,
      set: { is_member: isMember, checked_at: checkedAt },
    })
    .run();
}

export function getMeta(key: string): string | null {
  const row = db
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key))
    .get();
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  db.insert(meta)
    .values({ key, value })
    .onConflictDoUpdate({ target: meta.key, set: { value } })
    .run();
}

export interface ItemQuery {
  filter?: "needs" | "all";
  type?: ThreadType | "all";
  repo?: string; // "owner/repo" or "all"
  q?: string;
  sort?: "oldest" | "newest";
  mine?: "all" | "assigned" | "review"; // personal queue; overrides `filter`
  excludeTeamAuthored?: boolean; // hide threads opened by a team member
  excludeAssigned?: boolean; // hide issues/PRs that already have an assignee
}

/** A thread the author is NOT on the team allowlist (null author counts as outside). */
const authorIsOutside: SQL = sql`(${items.author} is null or lower(${items.author}) not in (select ${teamMembers.login} from ${teamMembers}))`;

export function queryItems(opts: ItemQuery): ItemView[] {
  const where: SQL[] = [];
  if (opts.mine === "assigned") {
    where.push(eq(items.assigned_to_me, true));
  } else if (opts.mine === "review") {
    where.push(eq(items.review_requested_from_me, true));
  } else if (opts.mine === "all") {
    where.push(
      or(
        eq(items.assigned_to_me, true),
        eq(items.review_requested_from_me, true)
      )!
    );
  } else if (opts.filter !== "all") {
    where.push(eq(items.needs_attention, true));
  }
  if (opts.type && opts.type !== "all") {
    where.push(eq(items.type, opts.type));
  }
  if (opts.repo && opts.repo !== "all") {
    where.push(eq(items.repo, opts.repo));
  }
  if (opts.excludeTeamAuthored) {
    where.push(authorIsOutside);
  }
  if (opts.excludeAssigned) {
    where.push(eq(items.has_assignee, false));
  }
  if (opts.q) {
    const pattern = `%${opts.q}%`;
    where.push(
      or(
        like(items.title, pattern),
        like(items.author, pattern),
        like(items.last_actor, pattern),
        eq(items.number, Number(opts.q) || -1)
      )!
    );
  }
  const rows = db
    .select()
    .from(items)
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      opts.sort === "newest"
        ? desc(items.last_entry_at)
        : asc(items.last_entry_at)
    )
    .all();
  return attachChildren(rows);
}

/** Fetch labels/reactions for a set of items in two queries and stitch them in. */
function attachChildren(rows: (typeof items.$inferSelect)[]): ItemView[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const labelsByItem = new Map<number, string[]>();
  for (const l of db
    .select()
    .from(itemLabels)
    .where(inArray(itemLabels.item_id, ids))
    .all()) {
    const list = labelsByItem.get(l.item_id);
    if (list) list.push(l.label);
    else labelsByItem.set(l.item_id, [l.label]);
  }
  const reactionsByItem = new Map<number, Record<string, number>>();
  for (const r of db
    .select()
    .from(itemReactions)
    .where(inArray(itemReactions.item_id, ids))
    .all()) {
    const map = reactionsByItem.get(r.item_id) ?? {};
    map[r.emoji] = r.count;
    reactionsByItem.set(r.item_id, map);
  }
  return rows.map((r) => ({
    ...r,
    labels: labelsByItem.get(r.id) ?? [],
    reactions: reactionsByItem.get(r.id) ?? {},
  }));
}

export function counts(): { tracked: number; needs: number } {
  return (
    db
      .select({
        tracked: count(),
        needs: sql<number>`coalesce(sum(${items.needs_attention}), 0)`,
      })
      .from(items)
      .get() ?? { tracked: 0, needs: 0 }
  );
}

export function personalCounts(): {
  mine: number;
  assigned: number;
  review: number;
} {
  return (
    db
      .select({
        mine: sql<number>`count(*) filter (where ${items.assigned_to_me} = 1 or ${items.review_requested_from_me} = 1)`,
        assigned: sql<number>`coalesce(sum(${items.assigned_to_me}), 0)`,
        review: sql<number>`coalesce(sum(${items.review_requested_from_me}), 0)`,
      })
      .from(items)
      .get() ?? { mine: 0, assigned: 0, review: 0 }
  );
}

export interface RepoCounts {
  repo: string;
  tracked: number;
  needs: number;
  assigned: number;
  review: number;
  mine: number;
}

export function countsByRepo(): RepoCounts[] {
  return db
    .select({
      repo: items.repo,
      tracked: count(),
      needs: sql<number>`coalesce(sum(${items.needs_attention}), 0)`,
      assigned: sql<number>`coalesce(sum(${items.assigned_to_me}), 0)`,
      review: sql<number>`coalesce(sum(${items.review_requested_from_me}), 0)`,
      mine: sql<number>`count(*) filter (where ${items.assigned_to_me} = 1 or ${items.review_requested_from_me} = 1)`,
    })
    .from(items)
    .groupBy(items.repo)
    .orderBy(items.repo)
    .all();
}
