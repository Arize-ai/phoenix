import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { PORT, REPOS, SYNC_INTERVAL_MINUTES } from "./config.ts";
import {
  counts,
  countsByRepo,
  db,
  getMeta,
  personalCounts,
  queryItems,
  type ItemQuery,
} from "./db.ts";
import { getStatus, runSync } from "./sync.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../web/dist");

const app = express();
app.use(express.json());
// Treat any non-JSON body as raw text, so `curl --data-binary 'SELECT …'`
// (which defaults to form-urlencoded) reaches /api/debug/sql as a string.
app.use(express.text({ type: "*/*" }));

app.get("/api/status", (_req, res) => {
  res.json({
    repos: REPOS,
    lastSyncAt: getMeta("last_sync_at"),
    counts: counts(),
    personal: personalCounts(),
    byRepo: countsByRepo(),
    sync: getStatus(),
  });
});

const MINE_VALUES = ["all", "assigned", "review"] as const;

app.get("/api/items", (req, res) => {
  const mine = MINE_VALUES.find((v) => v === req.query.mine);
  const opts: ItemQuery = {
    filter: req.query.filter === "all" ? "all" : "needs",
    type: (req.query.type as ItemQuery["type"]) ?? "all",
    repo: typeof req.query.repo === "string" ? req.query.repo : "all",
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    sort: req.query.sort === "newest" ? "newest" : "oldest",
    mine,
  };
  res.json({ items: queryItems(opts) });
});

/**
 * Debug: run one arbitrary SQL statement against the in-memory DB and stream
 * the result as JSONL (one JSON object per line). SELECT-style statements
 * stream their rows; anything else returns a single `{changes, lastInsertRowid}`
 * line. SQL comes from `?sql=`, a raw text body, or a JSON `{ "sql": "…" }`.
 * Local dev tool over a throwaway cache of public GitHub data — no auth.
 *
 *   curl -s --data-binary 'SELECT type, COUNT(*) n FROM items GROUP BY type' \
 *     localhost:PORT/api/debug/sql
 */
app.all("/api/debug/sql", (req, res) => {
  const sql =
    typeof req.query.sql === "string"
      ? req.query.sql
      : typeof req.body === "string"
        ? req.body
        : typeof req.body?.sql === "string"
          ? req.body.sql
          : "";
  if (!sql.trim()) {
    res.status(400).json({
      error: 'Provide SQL via ?sql=, a text body, or {"sql":"…"}.',
    });
    return;
  }
  try {
    const stmt = db.prepare(sql);
    res.type("application/x-ndjson");
    if (stmt.reader) {
      for (const row of stmt.iterate()) {
        res.write(JSON.stringify(row) + "\n");
      }
    } else {
      const info = stmt.run();
      res.write(
        JSON.stringify({
          changes: info.changes,
          lastInsertRowid: Number(info.lastInsertRowid),
        }) + "\n"
      );
    }
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If we've already started streaming rows, we can't change the status — just
    // append the error as a final JSONL line and close.
    if (res.headersSent) {
      res.write(JSON.stringify({ error: msg }) + "\n");
      res.end();
    } else {
      res.status(400).json({ error: msg });
    }
  }
});

app.post("/api/sync", (req, res) => {
  if (getStatus().running) {
    res.status(409).json({ error: "Sync already running", sync: getStatus() });
    return;
  }
  const full = req.query.full === "1" || req.query.full === "true";
  void runSync({ full }); // fire-and-forget; clients poll /api/status
  res.status(202).json({ sync: getStatus() });
});

if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.listen(PORT, () => {
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
