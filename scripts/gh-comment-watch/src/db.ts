import Database from "better-sqlite3";

import type { ItemRow } from "./types.ts";

// In-memory: the DB lives for the life of the server process and is rebuilt by
// the startup sync. Nothing persists across restarts, which keeps the schema
// always current (no migrations) — a restart just re-baselines from GitHub.
export const db = new Database(":memory:");

// The items table is a derived cache keyed on a globally-unique `uid` that
// embeds the repo (numbers collide across repos, and discussions have their own
// number space).
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    uid                      TEXT PRIMARY KEY,
    repo                     TEXT NOT NULL,
    number                   INTEGER NOT NULL,
    type                     TEXT NOT NULL,
    title                    TEXT NOT NULL,
    state                    TEXT NOT NULL,
    html_url                 TEXT NOT NULL,
    author                   TEXT,
    created_at               TEXT,
    updated_at               TEXT,
    closed_at                TEXT,
    comments_count           INTEGER,
    labels                   TEXT,
    needs_attention          INTEGER NOT NULL DEFAULT 0,
    reason                   TEXT,
    last_actor               TEXT,
    last_actor_is_team       INTEGER,
    last_actor_is_bot        INTEGER,
    last_actor_is_org_member INTEGER,
    assigned_to_me           INTEGER NOT NULL DEFAULT 0,
    review_requested_from_me INTEGER NOT NULL DEFAULT 0,
    last_entry_at            TEXT,
    last_entry_url           TEXT,
    last_entry_excerpt       TEXT,
    last_entry_kind          TEXT,
    synced_at                TEXT
  );

  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

  -- Cache of org-membership checks so we don't re-hit GitHub every sync.
  CREATE TABLE IF NOT EXISTS member_cache (
    login      TEXT PRIMARY KEY COLLATE NOCASE,
    is_member  INTEGER NOT NULL,
    checked_at TEXT NOT NULL
  );
`);

// The item columns in one place: the upsert's INSERT/VALUES/SET clauses are all
// derived from this, so adding a tracked field means editing only this list
// (and the matching CREATE TABLE above + the ItemRow type).
const ITEM_COLUMNS: Array<keyof ItemRow> = [
  "uid",
  "repo",
  "number",
  "type",
  "title",
  "state",
  "html_url",
  "author",
  "created_at",
  "updated_at",
  "closed_at",
  "comments_count",
  "labels",
  "needs_attention",
  "reason",
  "last_actor",
  "last_actor_is_team",
  "last_actor_is_bot",
  "last_actor_is_org_member",
  "assigned_to_me",
  "review_requested_from_me",
  "last_entry_at",
  "last_entry_url",
  "last_entry_excerpt",
  "last_entry_kind",
  "synced_at",
];

// Set out-of-band by the personal-queue search (`setPersonalFlags`), not by
// triage — so re-triaging a thread must NOT clobber them. New inserts start at
// the column default (0) and the search fills them in.
const PERSONAL_COLUMNS = ["assigned_to_me", "review_requested_from_me"];

const upsertStmt = db.prepare(`
  INSERT INTO items (${ITEM_COLUMNS.join(", ")})
  VALUES (${ITEM_COLUMNS.map((c) => "@" + c).join(", ")})
  ON CONFLICT(uid) DO UPDATE SET
    ${ITEM_COLUMNS.filter((c) => c !== "uid" && !PERSONAL_COLUMNS.includes(c))
      .map((c) => `${c}=excluded.${c}`)
      .join(", ")}
`);

export function upsertItem(row: ItemRow): void {
  upsertStmt.run(row);
}

/**
 * Drop rows not touched by a full baseline sync (closed or aged out). Every row
 * seen this run has synced_at == syncedAt, so older rows weren't returned.
 */
export function pruneItems(syncedAt: string): void {
  db.prepare(`DELETE FROM items WHERE synced_at < ?`).run(syncedAt);
}

/** Remove a single tracked item by uid (e.g. it was closed since last sync). */
export function deleteItem(uid: string): void {
  db.prepare(`DELETE FROM items WHERE uid = ?`).run(uid);
}

const resetPersonalStmt = db.prepare(
  `UPDATE items SET assigned_to_me = 0, review_requested_from_me = 0`
);
const setAssignedStmt = db.prepare(
  `UPDATE items SET assigned_to_me = 1 WHERE uid = ?`
);
const setReviewStmt = db.prepare(
  `UPDATE items SET review_requested_from_me = 1 WHERE uid = ?`
);

/**
 * Replace the personal-queue flags wholesale from the latest search results:
 * clear everything, then mark the assigned/review-requested uids. One
 * transaction so a reader never sees a half-cleared state. Uids not currently
 * tracked simply no-op (they'll get the flag once triage adds the row).
 */
export const setPersonalFlags = db.transaction(
  (assignedUids: string[], reviewUids: string[]) => {
    resetPersonalStmt.run();
    for (const uid of assignedUids) setAssignedStmt.run(uid);
    for (const uid of reviewUids) setReviewStmt.run(uid);
  }
);

export function getCachedMembership(
  login: string
): { is_member: number; checked_at: string } | undefined {
  return db
    .prepare(`SELECT is_member, checked_at FROM member_cache WHERE login = ?`)
    .get(login) as { is_member: number; checked_at: string } | undefined;
}

export function setCachedMembership(
  login: string,
  isMember: boolean,
  checkedAt: string
): void {
  db.prepare(
    `INSERT INTO member_cache (login, is_member, checked_at) VALUES (?, ?, ?)
     ON CONFLICT(login) DO UPDATE SET
       is_member = excluded.is_member, checked_at = excluded.checked_at`
  ).run(login, isMember ? 1 : 0, checkedAt);
}

export function getMeta(key: string): string | null {
  const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export interface ItemQuery {
  filter?: "needs" | "all";
  type?: "issue" | "pr" | "discussion" | "all";
  repo?: string; // "owner/repo" or "all"
  q?: string;
  sort?: "oldest" | "newest";
  mine?: "all" | "assigned" | "review"; // personal queue; overrides `filter`
}

export function queryItems(opts: ItemQuery): ItemRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.mine === "assigned") {
    where.push(`assigned_to_me = 1`);
  } else if (opts.mine === "review") {
    where.push(`review_requested_from_me = 1`);
  } else if (opts.mine === "all") {
    where.push(`(assigned_to_me = 1 OR review_requested_from_me = 1)`);
  } else if (opts.filter !== "all") {
    where.push(`needs_attention = 1`);
  }
  if (opts.type && opts.type !== "all") {
    where.push(`type = ?`);
    params.push(opts.type);
  }
  if (opts.repo && opts.repo !== "all") {
    where.push(`repo = ?`);
    params.push(opts.repo);
  }
  if (opts.q) {
    where.push(
      `(title LIKE ? OR author LIKE ? OR last_actor LIKE ? OR number = ?)`
    );
    const like = `%${opts.q}%`;
    params.push(like, like, like, Number(opts.q) || -1);
  }
  const order =
    opts.sort === "newest" ? `last_entry_at DESC` : `last_entry_at ASC`;
  const sql =
    `SELECT * FROM items` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY ${order}`;
  return db.prepare(sql).all(...params) as ItemRow[];
}

export function counts(): { tracked: number; needs: number } {
  return db
    .prepare(
      `SELECT COUNT(*) AS tracked, COALESCE(SUM(needs_attention), 0) AS needs
       FROM items`
    )
    .get() as { tracked: number; needs: number };
}

export function personalCounts(): {
  mine: number;
  assigned: number;
  review: number;
} {
  return db
    .prepare(
      `SELECT
         COUNT(*) FILTER (WHERE assigned_to_me = 1 OR review_requested_from_me = 1) AS mine,
         COALESCE(SUM(assigned_to_me), 0) AS assigned,
         COALESCE(SUM(review_requested_from_me), 0) AS review
       FROM items`
    )
    .get() as { mine: number; assigned: number; review: number };
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
    .prepare(
      `SELECT repo,
              COUNT(*) AS tracked,
              COALESCE(SUM(needs_attention), 0) AS needs,
              COALESCE(SUM(assigned_to_me), 0) AS assigned,
              COALESCE(SUM(review_requested_from_me), 0) AS review,
              COUNT(*) FILTER (
                WHERE assigned_to_me = 1 OR review_requested_from_me = 1
              ) AS mine
       FROM items GROUP BY repo ORDER BY repo`
    )
    .all() as RepoCounts[];
}
