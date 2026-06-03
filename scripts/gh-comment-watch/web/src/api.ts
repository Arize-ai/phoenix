export interface Item {
  uid: string;
  repo: string;
  number: number;
  type: "issue" | "pr" | "discussion";
  title: string;
  state: string;
  html_url: string;
  author: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments_count: number;
  labels: string;
  needs_attention: number;
  reason: string;
  last_actor: string | null;
  last_actor_is_team: number;
  last_actor_is_bot: number;
  last_actor_is_org_member: number;
  assigned_to_me: number;
  review_requested_from_me: number;
  last_entry_at: string | null;
  last_entry_url: string | null;
  last_entry_excerpt: string | null;
  last_entry_kind: string | null;
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

export interface Status {
  repos: string[];
  lastSyncAt: string | null;
  counts: { tracked: number; needs: number };
  personal: { mine: number; assigned: number; review: number };
  byRepo: Array<{
    repo: string;
    tracked: number;
    needs: number;
    assigned: number;
    review: number;
    mine: number;
  }>;
  sync: SyncStatus;
}

export type Tab = "needs" | "all" | "mine";
export type MineFilter = "all" | "assigned" | "review";
export type TypeFilter = "all" | "issue" | "pr" | "discussion";

/** All UI filter state. The active `tab` decides which fields are sent. */
export interface ItemFilters {
  tab: Tab; // "needs" / "all" tracked / "mine" (personal)
  mine: MineFilter; // personal view sub-filter
  type: TypeFilter; // needs/all views only
  repo: string; // "all" or "owner/repo" — shared across tabs
  q: string; // shared
  sort: "oldest" | "newest"; // shared
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  status: () => fetch("/api/status").then((r) => json<Status>(r)),
  items: (f: ItemFilters) => {
    const p = new URLSearchParams({ repo: f.repo, sort: f.sort });
    if (f.q) p.set("q", f.q);
    if (f.tab === "mine") {
      p.set("mine", f.mine);
    } else {
      p.set("filter", f.tab === "all" ? "all" : "needs");
      p.set("type", f.type);
    }
    return fetch(`/api/items?${p}`).then((r) => json<{ items: Item[] }>(r));
  },
  sync: () =>
    fetch("/api/sync", { method: "POST" }).then((r) =>
      json<{ sync: SyncStatus }>(r)
    ),
};

export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - Date.parse(iso);
  const d = Math.floor(diff / 86_400_000);
  if (d > 0) return d === 1 ? "1 day ago" : `${d} days ago`;
  const h = Math.floor(diff / 3_600_000);
  if (h > 0) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const m = Math.floor(diff / 60_000);
  if (m > 0) return m === 1 ? "1 min ago" : `${m} mins ago`;
  return "just now";
}

export function ageDays(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}
