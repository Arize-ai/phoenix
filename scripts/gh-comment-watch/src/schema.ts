import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const items = sqliteTable("items", {
  uid: text("uid").primaryKey(),
  repo: text("repo").notNull(),
  number: integer("number").notNull(),
  type: text("type", { enum: ["issue", "pr", "discussion"] }).notNull(),
  title: text("title").notNull(),
  state: text("state").notNull(),
  html_url: text("html_url").notNull(),
  author: text("author"),
  author_is_team: integer("author_is_team").notNull().default(0),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  closed_at: text("closed_at"),
  comments_count: integer("comments_count").notNull(),
  labels: text("labels").notNull(),
  needs_attention: integer("needs_attention").notNull().default(0),
  reason: text("reason").notNull(),
  last_actor: text("last_actor"),
  last_actor_is_team: integer("last_actor_is_team").notNull(),
  last_actor_is_bot: integer("last_actor_is_bot").notNull(),
  last_actor_is_org_member: integer("last_actor_is_org_member")
    .notNull()
    .default(0),
  assigned_to_me: integer("assigned_to_me").notNull().default(0),
  review_requested_from_me: integer("review_requested_from_me")
    .notNull()
    .default(0),
  last_entry_at: text("last_entry_at"),
  last_entry_url: text("last_entry_url"),
  last_entry_excerpt: text("last_entry_excerpt"),
  last_entry_kind: text("last_entry_kind"),
  synced_at: text("synced_at").notNull(),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const memberCache = sqliteTable("member_cache", {
  login: text("login").primaryKey(),
  is_member: integer("is_member").notNull(),
  checked_at: text("checked_at").notNull(),
});
