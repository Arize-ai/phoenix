import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  and,
  asc,
  count,
  desc,
  eq,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { DB_FILE_NAME } from "./config.ts";
import { items, memberCache, meta } from "./schema.ts";
import type { ItemRow } from "./types.ts";

fs.mkdirSync(path.dirname(DB_FILE_NAME), { recursive: true });

const sqlite = new Database(DB_FILE_NAME);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle({
  client: sqlite,
  schema: { items, memberCache, meta },
});

export function upsertItem(row: ItemRow): void {
  void db
    .insert(items)
    .values(row)
    .onConflictDoUpdate({
      target: items.uid,
      set: {
        repo: row.repo,
        number: row.number,
        type: row.type,
        title: row.title,
        state: row.state,
        html_url: row.html_url,
        author: row.author,
        author_is_team: row.author_is_team,
        created_at: row.created_at,
        updated_at: row.updated_at,
        closed_at: row.closed_at,
        comments_count: row.comments_count,
        labels: row.labels,
        needs_attention: row.needs_attention,
        reason: row.reason,
        last_actor: row.last_actor,
        last_actor_is_team: row.last_actor_is_team,
        last_actor_is_bot: row.last_actor_is_bot,
        last_actor_is_org_member: row.last_actor_is_org_member,
        last_entry_at: row.last_entry_at,
        last_entry_url: row.last_entry_url,
        last_entry_excerpt: row.last_entry_excerpt,
        last_entry_kind: row.last_entry_kind,
        synced_at: row.synced_at,
      },
    })
    .run();
}

/**
 * Drop rows not touched by a full baseline sync (closed or aged out). Every row
 * seen this run has synced_at == syncedAt, so older rows weren't returned.
 */
export function pruneItems(syncedAt: string): void {
  void db
    .delete(items)
    .where(sql`${items.synced_at} < ${syncedAt}`)
    .run();
}

/** Remove a single tracked item by uid (e.g. it was closed since last sync). */
export function deleteItem(uid: string): void {
  void db.delete(items).where(eq(items.uid, uid)).run();
}

/**
 * Replace the personal-queue flags wholesale from the latest search results:
 * clear everything, then mark the assigned/review-requested uids. One
 * transaction so a reader never sees a half-cleared state. Uids not currently
 * tracked simply no-op (they'll get the flag once triage adds the row).
 */
export function setPersonalFlags(
  assignedUids: string[],
  reviewUids: string[]
): void {
  db.transaction((tx) => {
    void tx
      .update(items)
      .set({ assigned_to_me: 0, review_requested_from_me: 0 })
      .run();
    for (const uid of assignedUids) {
      void tx
        .update(items)
        .set({ assigned_to_me: 1 })
        .where(eq(items.uid, uid))
        .run();
    }
    for (const uid of reviewUids) {
      void tx
        .update(items)
        .set({ review_requested_from_me: 1 })
        .where(eq(items.uid, uid))
        .run();
    }
  });
}

export function getCachedMembership(
  login: string
): { is_member: number; checked_at: string } | undefined {
  return db
    .select({
      is_member: memberCache.is_member,
      checked_at: memberCache.checked_at,
    })
    .from(memberCache)
    .where(eq(memberCache.login, login.toLowerCase()))
    .get();
}

export function setCachedMembership(
  login: string,
  isMember: boolean,
  checkedAt: string
): void {
  void db
    .insert(memberCache)
    .values({
      login: login.toLowerCase(),
      is_member: isMember ? 1 : 0,
      checked_at: checkedAt,
    })
    .onConflictDoUpdate({
      target: memberCache.login,
      set: { is_member: isMember ? 1 : 0, checked_at: checkedAt },
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
  void db
    .insert(meta)
    .values({ key, value })
    .onConflictDoUpdate({ target: meta.key, set: { value } })
    .run();
}

export interface ItemQuery {
  filter?: "needs" | "all";
  type?: "issue" | "pr" | "discussion" | "all";
  repo?: string; // "owner/repo" or "all"
  q?: string;
  sort?: "oldest" | "newest";
  mine?: "all" | "assigned" | "review"; // personal queue; overrides `filter`
  excludeTeamAuthored?: boolean; // hide threads opened by a team member
}

export function queryItems(opts: ItemQuery): ItemRow[] {
  const where: SQL[] = [];
  if (opts.mine === "assigned") {
    where.push(eq(items.assigned_to_me, 1));
  } else if (opts.mine === "review") {
    where.push(eq(items.review_requested_from_me, 1));
  } else if (opts.mine === "all") {
    where.push(
      or(eq(items.assigned_to_me, 1), eq(items.review_requested_from_me, 1))!
    );
  } else if (opts.filter !== "all") {
    where.push(eq(items.needs_attention, 1));
  }
  if (opts.type && opts.type !== "all") {
    where.push(eq(items.type, opts.type));
  }
  if (opts.repo && opts.repo !== "all") {
    where.push(eq(items.repo, opts.repo));
  }
  if (opts.excludeTeamAuthored) {
    where.push(eq(items.author_is_team, 0));
  }
  if (opts.q) {
    const searchPattern = `%${opts.q}%`;
    where.push(
      or(
        like(items.title, searchPattern),
        like(items.author, searchPattern),
        like(items.last_actor, searchPattern),
        eq(items.number, Number(opts.q) || -1)
      )!
    );
  }
  return db
    .select()
    .from(items)
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      opts.sort === "newest"
        ? desc(items.last_entry_at)
        : asc(items.last_entry_at)
    )
    .all();
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
