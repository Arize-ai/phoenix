import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { PORT, REPOS, SYNC_INTERVAL_MINUTES } from "./config.ts";
import {
  counts,
  countsByRepo,
  getMeta,
  personalCounts,
  queryItems,
  type ItemQuery,
} from "./db.ts";
import { getStatus, runSync } from "./sync.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../web/dist");

const app = new Hono();

app.get("/api/status", (context) => {
  return context.json({
    repos: REPOS,
    lastSyncAt: getMeta("last_sync_at"),
    counts: counts(),
    personal: personalCounts(),
    byRepo: countsByRepo(),
    sync: getStatus(),
  });
});

const MINE_VALUES = ["all", "assigned", "review"] as const;

app.get("/api/items", (context) => {
  const query = context.req.query();
  const mine = MINE_VALUES.find((value) => value === query.mine);
  const opts: ItemQuery = {
    filter: query.filter === "all" ? "all" : "needs",
    type: getTypeFilter(query.type),
    repo: query.repo ?? "all",
    q: query.q,
    sort: query.sort === "newest" ? "newest" : "oldest",
    mine,
    excludeTeamAuthored: query.excludeTeamAuthored === "1",
  };
  return context.json({ items: queryItems(opts) });
});

app.post("/api/sync", (context) => {
  if (getStatus().running) {
    return context.json(
      { error: "Sync already running", sync: getStatus() },
      409
    );
  }
  const full =
    context.req.query("full") === "1" || context.req.query("full") === "true";
  void runSync({ full }); // fire-and-forget; clients poll /api/status
  return context.json({ sync: getStatus() }, 202);
});

if (fs.existsSync(webDist)) {
  app.use("/*", serveStatic({ root: webDist }));
  app.get("*", (context) => {
    if (context.req.path.startsWith("/api/")) return context.notFound();
    return context.html(
      fs.readFileSync(path.join(webDist, "index.html"), "utf8")
    );
  });
}

const server = serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(
    `gh-comment-watch monitoring ${REPOS.join(", ")} → http://localhost:${PORT}` +
      (fs.existsSync(webDist) ? "" : "\n(web not built yet — run `pnpm build`)")
  );

  // Keep the DB fresh on its own: an initial sync, then incremental ones.
  void runSync();
  if (SYNC_INTERVAL_MINUTES > 0) {
    console.log(`Auto-syncing every ${SYNC_INTERVAL_MINUTES} min.`);
    setInterval(() => {
      if (!getStatus().running) void runSync();
    }, SYNC_INTERVAL_MINUTES * 60_000);
  }
});

function getTypeFilter(value: string | undefined): ItemQuery["type"] {
  if (value === "issue" || value === "pr" || value === "discussion")
    return value;
  return "all";
}

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
