#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { parseCliOptions } from "./cli";
import { App } from "./components/App";
import { buildServerAgentChatUrl, resolveConfig } from "./config";

const cli = parseCliOptions(process.argv.slice(2));
const { baseUrl, headers } = resolveConfig({
  host: cli.host,
  apiKey: cli.apiKey,
});
const chatUrl = buildServerAgentChatUrl(baseUrl, cli.sessionId);

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(
  <App
    chatUrl={chatUrl}
    headers={headers}
    host={baseUrl}
    sessionId={cli.sessionId}
    model={{
      providerType: "builtin",
      provider: cli.provider,
      modelName: cli.model,
    }}
    modelLabel={`${cli.provider} · ${cli.model}`}
  />
);
