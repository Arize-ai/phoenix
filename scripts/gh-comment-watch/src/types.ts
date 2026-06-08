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
  pull_request?: unknown;
}

export interface GhComment {
  id: number;
  html_url: string;
  user: GhUser | null;
  created_at: string;
  body: string | null;
}

/** One row of the monitor table — a tracked thread with its triage verdict. */
export interface ItemRow {
  /** Globally-unique key: "<owner/repo>#i<number>" or "<owner/repo>#d<number>". */
  uid: string;
  repo: string; // "owner/repo"
  number: number;
  type: "issue" | "pr" | "discussion";
  title: string;
  state: string;
  html_url: string;
  author: string | null;
  author_is_team: number; // 0 | 1 — thread opened by someone on the team allowlist
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments_count: number;
  labels: string; // JSON array
  needs_attention: number; // 0 | 1
  reason: string;
  last_actor: string | null;
  last_actor_is_team: number;
  last_actor_is_bot: number;
  last_actor_is_org_member: number; // org member but not on the team allowlist
  assigned_to_me: number; // 0 | 1 — directly assigned to the viewer
  review_requested_from_me: number; // 0 | 1 — viewer personally requested as reviewer
  last_entry_at: string | null;
  last_entry_url: string | null;
  last_entry_excerpt: string | null;
  last_entry_kind: string | null; // "body" | "comment"
  synced_at: string;
}

export interface SyncStatus {
  running: boolean;
  total: number;
  done: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  needsAttention: number;
}
