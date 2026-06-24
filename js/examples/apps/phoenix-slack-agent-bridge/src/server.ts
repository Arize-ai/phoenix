import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { createBot } from "./bot.js";
import { loadBridgeConfig } from "./config.js";

const config = loadBridgeConfig();
const bot = createBot(config);
const app = new Hono();

app.get("/health", (context) => context.text("ok"));

app.post("/api/webhooks/slack", (context) => {
  return bot.webhooks.slack(context.req.raw, {
    waitUntil: (task) => {
      void task.catch((error) => {
        console.error("Slack webhook background task failed", error);
      });
    },
  });
});

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(
      `Phoenix Slack agent bridge listening on http://localhost:${info.port}`
    );
  }
);
