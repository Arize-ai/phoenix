import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * One tracked thread (issue, PR, or discussion). `id` is a surrogate key so the
 * child tables can reference a single stable column; `(repo, type, number)` is
 * the natural key the sync upserts against. Only *open* threads live here —
 * closed/merged ones are deleted — so there's no `state`/`closed_at`.
 *
 * The `last_*` / `needs_attention` / `reason` columns are the materialized
 * triage verdict: derived data, but that verdict is the whole point of the
 * cache (the read model), so it's stored rather than recomputed per request.
 */
export const items = sqliteTable(
  "items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    repo: text("repo").notNull(), // "owner/repo"
    type: text("type", { enum: ["issue", "pr", "discussion"] }).notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    html_url: text("html_url").notNull(),
    author: text("author"), // login; null for ghosted/deleted accounts
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    // --- triage verdict (materialized read model) ---
    needs_attention: integer("needs_attention", { mode: "boolean" }).notNull(),
    reason: text("reason").notNull(),
    last_actor: text("last_actor"),
    last_actor_is_bot: integer("last_actor_is_bot", {
      mode: "boolean",
    }).notNull(),
    // Cached external lookup (org membership), not a derivable local fact.
    last_actor_is_org_member: integer("last_actor_is_org_member", {
      mode: "boolean",
    }).notNull(),
    // Always populated: every thread has an opening post, so there's always a
    // displayable entry. Declared NOT NULL so ordering by it can't surface NULLs.
    last_entry_at: text("last_entry_at").notNull(),
    last_entry_url: text("last_entry_url").notNull(),
    last_entry_excerpt: text("last_entry_excerpt").notNull(),
    // --- assignment / personal queue ---
    has_assignee: integer("has_assignee", { mode: "boolean" }).notNull(),
    assigned_to_me: integer("assigned_to_me", { mode: "boolean" }).notNull(),
    review_requested_from_me: integer("review_requested_from_me", {
      mode: "boolean",
    }).notNull(),
    synced_at: text("synced_at").notNull(),
  },
  (t) => [
    unique("items_repo_type_number").on(t.repo, t.type, t.number),
    index("items_repo_idx").on(t.repo),
    index("items_needs_idx").on(t.needs_attention),
    check("items_type_valid", sql`${t.type} in ('issue', 'pr', 'discussion')`),
  ]
);

/** Labels on a thread (1NF — one row per label, not a JSON array). */
export const itemLabels = sqliteTable(
  "item_labels",
  {
    item_id: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
  },
  (t) => [primaryKey({ columns: [t.item_id, t.label] })]
);

/**
 * Outside-user reaction tally per emoji (1NF). One row per emoji; `count` is
 * already filtered to exclude team members and bots. We don't keep individual
 * reactors, so per-emoji counts are the natural grain.
 */
export const itemReactions = sqliteTable(
  "item_reactions",
  {
    item_id: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(), // GitHub reaction key: "+1", "heart", …
    count: integer("count").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.item_id, t.emoji] }),
    check("item_reactions_count_nonneg", sql`${t.count} >= 0`),
  ]
);

/**
 * The team allowlist as data. Storing it lets "author is on the team" be a join
 * (`NOT IN team_members`) instead of a per-row derived flag that goes stale when
 * the roster changes. Logins are stored lowercased for case-insensitive joins.
 */
export const teamMembers = sqliteTable("team_members", {
  login: text("login").primaryKey(),
});

/** Cached org-membership lookups (external, TTL'd in code). */
export const orgMembershipCache = sqliteTable("org_membership_cache", {
  login: text("login").primaryKey(),
  is_member: integer("is_member", { mode: "boolean" }).notNull(),
  checked_at: text("checked_at").notNull(),
});

/** Sync bookkeeping: per-repo watermarks and last-sync status (key/value). */
export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
