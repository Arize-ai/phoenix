export interface GhUser {
  login: string;
  type: string; // "User" | "Bot" | "Organization"
}

/** A GitHub issue or pull request (the issues endpoint returns both). */
export interface GhIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: GhUser | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  body: string | null;
  labels: Array<{ name: string }>;
  assignees?: GhUser[] | null;
  /** Aggregate reaction counts (totals only, no logins) — used as a cheap gate
   * before fetching the per-reactor list. */
  reactions?: { total_count: number } | null;
  pull_request?: unknown;
}

export interface GhComment {
  id: number;
  html_url: string;
  user: GhUser | null;
  created_at: string;
  body: string | null;
}

/** One reaction on an issue/PR, with the user who left it. */
export interface GhReaction {
  content: string; // "+1" | "-1" | "laugh" | "hooray" | "confused" | "heart" | "rocket" | "eyes"
  user: GhUser | null;
}

import type { items } from "./schema.ts";

export type ThreadType = "issue" | "pr" | "discussion";

/**
 * A tracked thread plus its triage verdict, ready to upsert. The personal-queue
 * flags are owned by the search pass, so they're absent here. `labels` and
 * `reactions` are written to their own child tables.
 */
export interface ItemInput {
  repo: string; // "owner/repo"
  type: ThreadType;
  number: number;
  title: string;
  html_url: string;
  author: string | null;
  created_at: string;
  updated_at: string;
  needs_attention: boolean;
  reason: string;
  last_actor: string | null;
  last_actor_is_bot: boolean;
  last_actor_is_org_member: boolean;
  last_entry_at: string; // always set — every thread has an opening post
  last_entry_url: string;
  last_entry_excerpt: string;
  has_assignee: boolean;
  synced_at: string;
  labels: string[];
  reactions: Record<string, number>; // emoji key → count, outside reactors only
}

/** A thread row as read back for the API: the stored columns plus its children. */
export type ItemView = typeof items.$inferSelect & {
  labels: string[];
  reactions: Record<string, number>;
};

export interface SyncStatus {
  running: boolean;
  total: number;
  done: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  needsAttention: number;
}
