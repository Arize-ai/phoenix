import { Fragment, useEffect, useRef, useState } from "react";

import {
  ageDays,
  api,
  relativeTime,
  type Item,
  type ItemFilters,
  type MineFilter,
  type Status,
  type Tab,
  type TypeFilter,
} from "./api.ts";

function useStatusPolling() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await api.status();
        if (!cancelled) {
          setStatus(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return { status, error };
}

// When sorted newest-first, draw a divider where the list crosses from "recent"
// into threads last touched this many days ago or longer.
const STALE_AFTER_DAYS = 3;

const TYPES: TypeFilter[] = ["all", "issue", "pr", "discussion"];
const TABS: Tab[] = ["needs", "all", "mine"];
const MINE_FILTERS: MineFilter[] = ["all", "assigned", "review"];
const SORTS: ItemFilters["sort"][] = ["oldest", "newest"];
const TYPE_LABEL: Record<TypeFilter, string> = {
  all: "All",
  issue: "Issues",
  pr: "PRs",
  discussion: "Discussions",
};

const DEFAULT_FILTERS: ItemFilters = {
  tab: "needs",
  mine: "all",
  type: "all",
  repo: "Arize-ai/phoenix",
  q: "",
  sort: "newest",
  excludeTeamAuthored: true,
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function useQueryFilters() {
  const [search, setSearch] = useState(window.location.search);

  useEffect(() => {
    const onPopState = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const filters = parseQueryFilters(search);

  function updateFilters(patch: Partial<ItemFilters>) {
    const nextFilters = {
      ...parseQueryFilters(window.location.search),
      ...patch,
    };
    const nextSearch = stringifyQueryFilters(nextFilters);
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    window.history.pushState(null, "", nextUrl);
    setSearch(window.location.search);
  }

  return { filters, updateFilters };
}

function parseQueryFilters(search: string): ItemFilters {
  const params = new URLSearchParams(search);
  const tab = parseOneOf(params.get("tab"), TABS, DEFAULT_FILTERS.tab);
  const mine = parseOneOf(
    params.get("mine"),
    MINE_FILTERS,
    DEFAULT_FILTERS.mine
  );
  const type = parseOneOf(params.get("type"), TYPES, DEFAULT_FILTERS.type);
  const sort = parseOneOf(params.get("sort"), SORTS, DEFAULT_FILTERS.sort);

  return {
    tab,
    mine,
    type,
    repo: params.get("repo") ?? DEFAULT_FILTERS.repo,
    q: params.get("q") ?? DEFAULT_FILTERS.q,
    sort,
    // Default-on; only an explicit "0" in the URL opts back into team-authored.
    excludeTeamAuthored: params.get("excludeTeamAuthored") !== "0",
  };
}

function stringifyQueryFilters(filters: ItemFilters): string {
  const params = new URLSearchParams();
  setQueryParam(params, "tab", filters.tab, DEFAULT_FILTERS.tab);
  setQueryParam(params, "mine", filters.mine, DEFAULT_FILTERS.mine);
  setQueryParam(params, "type", filters.type, DEFAULT_FILTERS.type);
  setQueryParam(params, "repo", filters.repo, DEFAULT_FILTERS.repo);
  setQueryParam(params, "q", filters.q, DEFAULT_FILTERS.q);
  setQueryParam(params, "sort", filters.sort, DEFAULT_FILTERS.sort);
  if (filters.excludeTeamAuthored !== DEFAULT_FILTERS.excludeTeamAuthored) {
    params.set("excludeTeamAuthored", filters.excludeTeamAuthored ? "1" : "0");
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function parseOneOf<T extends string>(
  value: string | null,
  values: readonly T[],
  fallback: T
): T {
  return values.find((candidate) => candidate === value) ?? fallback;
}

function setQueryParam(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string
) {
  if (value !== defaultValue) params.set(key, value);
}

export function App() {
  const { status, error: statusError } = useStatusPolling();
  const [items, setItems] = useState<Item[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { filters, updateFilters } = useQueryFilters();
  const [reloadKey, setReloadKey] = useState(0);
  const [isSyncStarting, setIsSyncStarting] = useState(false);
  const remoteSyncing = status?.sync.running ?? false;
  const syncing = remoteSyncing || isSyncStarting;
  const wasSyncing = useRef(false);

  // If the chosen repo isn't actually monitored (the default before status
  // loads, or a changed REPOS), fall back to the first — derived, no effect.
  const repos = status?.repos ?? [];
  const { tab, mine, type, q, sort, excludeTeamAuthored } = filters;
  const effectiveRepo =
    filters.repo === "all" || repos.length === 0 || repos.includes(filters.repo)
      ? filters.repo
      : repos[0];

  // Every count on screen (tab badges, stats, sub-filter labels) follows the
  // repo filter — pick a repo and all the numbers scope to it; "all" is global.
  const repoCounts =
    effectiveRepo === "all"
      ? null
      : status?.byRepo.find((x) => x.repo === effectiveRepo);
  const scoped =
    effectiveRepo === "all"
      ? {
          tracked: status?.counts.tracked ?? 0,
          needs: status?.counts.needs ?? 0,
          mine: status?.personal.mine ?? 0,
          assigned: status?.personal.assigned ?? 0,
          review: status?.personal.review ?? 0,
        }
      : {
          tracked: repoCounts?.tracked ?? 0,
          needs: repoCounts?.needs ?? 0,
          mine: repoCounts?.mine ?? 0,
          assigned: repoCounts?.assigned ?? 0,
          review: repoCounts?.review ?? 0,
        };

  // One banner for whatever's currently wrong, instead of a stack.
  const errors = [
    status?.sync.error && `Sync: ${status.sync.error}`,
    statusError && `Status: ${statusError}`,
    itemsError && `Items: ${itemsError}`,
    actionError && `Action: ${actionError}`,
  ].filter(Boolean) as string[];

  const hasListFilters =
    effectiveRepo !== "all" ||
    q.trim() !== "" ||
    (tab === "mine" ? mine !== "all" : type !== "all");
  const emptyMessage = !status?.lastSyncAt
    ? "No data yet. Click Sync now to pull from GitHub."
    : hasListFilters
      ? "No matching items for the current filters."
      : tab === "mine"
        ? "Nothing assigned to you or awaiting your review."
        : tab === "needs"
          ? "Nothing here - all caught up."
          : "No tracked items.";

  // Index of the first thread that's STALE_AFTER_DAYS old or older. Newest-first
  // sorting makes age non-decreasing down the list, so this is the single
  // crossover where the divider goes. Only drawn when at least one fresher
  // thread sits above it (index > 0); -1 disables it (other sorts, or an
  // all-fresh / all-stale list where a divider would be noise).
  const staleBoundaryIndex =
    sort === "newest"
      ? (() => {
          const i = items.findIndex(
            (it) => ageDays(it.last_entry_at) >= STALE_AFTER_DAYS
          );
          return i > 0 ? i : -1;
        })()
      : -1;

  // Reload the list when the (effective) filters change, or after a sync ends.
  // setState lives in an async callback, so it never cascades synchronously.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.items({
          tab,
          mine,
          type,
          repo: effectiveRepo,
          q,
          sort,
          excludeTeamAuthored,
        });
        if (!cancelled) {
          setItems(r.items);
          setItemsError(null);
        }
      } catch (err) {
        if (!cancelled) setItemsError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, mine, type, effectiveRepo, q, sort, excludeTeamAuthored, reloadKey]);

  useEffect(() => {
    if (wasSyncing.current && !remoteSyncing) setReloadKey((key) => key + 1);
    wasSyncing.current = remoteSyncing;
  }, [remoteSyncing]);

  async function triggerSync() {
    setActionError(null);
    setIsSyncStarting(true);
    try {
      await api.sync();
      window.setTimeout(() => setIsSyncStarting(false), 2000);
    } catch (err) {
      setActionError(errorMessage(err));
      setIsSyncStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">GH Comment Watch</h1>
            <p className="text-sm text-slate-400">
              {status?.repos.join(", ") ?? "…"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
            <span>
              Last sync:{" "}
              <span className="text-slate-200">
                {relativeTime(status?.lastSyncAt ?? null)}
              </span>
            </span>
            <button
              className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-60"
              onClick={triggerSync}
              disabled={syncing}
            >
              {remoteSyncing
                ? `Syncing ${status?.sync.done}/${status?.sync.total}…`
                : isSyncStarting
                  ? "Starting sync…"
                  : "Sync now"}
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl gap-1 px-6">
          <TabButton
            label="Needs reply"
            count={status ? scoped.needs : undefined}
            active={tab === "needs"}
            onClick={() => updateFilters({ tab: "needs" })}
          />
          <TabButton
            label="All tracked"
            count={status ? scoped.tracked : undefined}
            active={tab === "all"}
            onClick={() => updateFilters({ tab: "all" })}
          />
          <TabButton
            label="My queue"
            count={status ? scoped.mine : undefined}
            highlight
            active={tab === "mine"}
            onClick={() => updateFilters({ tab: "mine" })}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {errors.length > 0 && (
          <div className="mb-4 space-y-1 rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          {tab === "mine" ? (
            <Segmented
              options={[
                { v: "all", label: `All ${scoped.mine}` },
                { v: "assigned", label: `Assigned ${scoped.assigned}` },
                { v: "review", label: `Review ${scoped.review}` },
              ]}
              value={mine}
              onChange={(value) => updateFilters({ mine: value as MineFilter })}
            />
          ) : (
            <Segmented
              options={TYPES.map((t) => ({ v: t, label: TYPE_LABEL[t] }))}
              value={type}
              onChange={(value) => updateFilters({ type: value as TypeFilter })}
            />
          )}
          {status && status.repos.length > 1 && (
            <Segmented
              options={[
                { v: "all", label: "All repos" },
                ...status.repos.map((r) => ({
                  v: r,
                  label: r.split("/")[1] ?? r,
                })),
              ]}
              value={effectiveRepo}
              onChange={(value) => updateFilters({ repo: value })}
            />
          )}
          <input
            aria-label="Search title, author, or number"
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-sky-500"
            placeholder="Search title / author / #"
            value={q}
            onChange={(event) => updateFilters({ q: event.target.value })}
          />
          {tab !== "mine" && (
            <label
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 select-none"
              title="Hide threads opened by a team member (e.g. our own issues/PRs)"
            >
              <input
                type="checkbox"
                className="accent-sky-500"
                checked={excludeTeamAuthored}
                onChange={(event) =>
                  updateFilters({ excludeTeamAuthored: event.target.checked })
                }
              />
              Hide team-authored
            </label>
          )}
          <button
            className="ml-auto text-sm text-slate-400 hover:text-slate-200"
            onClick={() =>
              updateFilters({
                sort: sort === "oldest" ? "newest" : "oldest",
              })
            }
          >
            Sort: {sort === "oldest" ? "oldest first" : "newest first"}
          </button>
        </div>

        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="rounded-xl bg-slate-800 px-6 py-16 text-center text-slate-400 ring-1 ring-white/5">
              {emptyMessage}
            </div>
          ) : (
            items.map((it, index) => (
              <Fragment key={it.uid}>
                {index === staleBoundaryIndex && (
                  <DayDivider days={STALE_AFTER_DAYS} />
                )}
                <Row item={it} />
              </Fragment>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  highlight,
  onClick,
}: {
  label: string;
  count: number | undefined;
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
        active
          ? "border-sky-500 text-white"
          : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
      {count != null && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            highlight && count > 0
              ? "bg-sky-500/20 text-sky-300"
              : active
                ? "bg-white/10 text-slate-200"
                : "bg-slate-800 text-slate-400"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ v: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-slate-800 p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.v}
          aria-pressed={value === o.v}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === o.v
              ? "bg-sky-600 text-white"
              : "text-slate-300 hover:text-white"
          }`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DayDivider({ days }: { days: number }) {
  return (
    <div
      className="flex items-center gap-3 px-1 pt-3 pb-1 text-xs font-medium text-slate-500"
      role="separator"
    >
      <div className="h-px flex-1 bg-white/10" />
      {days} days ago or older
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function Row({ item }: { item: Item }) {
  const labels: string[] = (() => {
    try {
      return JSON.parse(item.labels);
    } catch {
      return [];
    }
  })();
  const days = ageDays(item.last_entry_at);
  const stale = item.needs_attention === 1 && days >= 7;

  return (
    <div className="flex gap-4 rounded-xl bg-slate-800 px-5 py-4 ring-1 ring-white/5 hover:ring-white/15">
      <div className="flex flex-col items-center pt-1">
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
            item.type === "pr"
              ? "bg-purple-500/20 text-purple-300"
              : item.type === "discussion"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-emerald-500/20 text-emerald-300"
          }`}
        >
          {item.type === "pr"
            ? "PR"
            : item.type === "discussion"
              ? "DISC"
              : "ISS"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
            {item.repo.split("/")[1] ?? item.repo}
          </span>
          <a
            href={item.html_url}
            target="_blank"
            rel="noreferrer"
            className="truncate font-medium text-slate-100 hover:text-sky-400"
          >
            #{item.number} {item.title}
          </a>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
          {item.assigned_to_me === 1 && (
            <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
              Assigned to me
            </span>
          )}
          {item.review_requested_from_me === 1 && (
            <span className="rounded bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-300">
              Review requested
            </span>
          )}
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              item.needs_attention
                ? "bg-amber-500/15 text-amber-300"
                : "bg-slate-700 text-slate-300"
            }`}
          >
            {item.reason}
          </span>
          <span>
            <span className="text-slate-500">by </span>
            <span className="text-slate-300">{item.author ?? "?"}</span>
          </span>
          <span>
            <span className="text-slate-500">last </span>
            <span className="text-slate-300">{item.last_actor ?? "?"}</span>
            {item.last_actor_is_org_member === 1 && (
              <span
                className="ml-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-300"
                title="Arize-ai org member, but not on the on-call team allowlist"
              >
                Arize-ai org
              </span>
            )}
            {item.last_actor_is_bot ? " (bot)" : ""} ·{" "}
            <span className={stale ? "text-amber-400" : ""}>
              {relativeTime(item.last_entry_at)}
            </span>
          </span>
          {labels.slice(0, 3).map((l) => (
            <span
              key={l}
              className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300"
            >
              {l}
            </span>
          ))}
        </div>

        {item.last_entry_excerpt && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-400">
            {item.last_entry_excerpt}
          </p>
        )}
      </div>

      <a
        href={item.last_entry_url ?? item.html_url}
        target="_blank"
        rel="noreferrer"
        className="self-center rounded-lg px-3 py-2 text-sm font-medium text-sky-400 hover:bg-white/5"
      >
        Open →
      </a>
    </div>
  );
}
