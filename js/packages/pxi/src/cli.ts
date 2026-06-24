import { Command } from "commander";

import type { ModelProvider } from "./chat/types";

/** PXI CLI version. Kept in sync with package.json `version`. */
const VERSION = "0.1.0";

/** Default built-in provider/model, mirroring the Phoenix web app default. */
const DEFAULT_PROVIDER: ModelProvider = "ANTHROPIC";
const DEFAULT_MODEL = "claude-opus-4-6";

export type CliOptions = {
  /** Phoenix server base URL override (falls back to PHOENIX_HOST). */
  host?: string;
  /** Phoenix API key override (falls back to PHOENIX_API_KEY). */
  apiKey?: string;
  /** Built-in model provider. */
  provider: ModelProvider;
  /** Model name for the selected provider. */
  model: string;
  /** Session id; a fresh UUID per run unless resuming an existing session. */
  sessionId: string;
};

/**
 * Parse PXI command-line flags. Accepts the argv slice *after* the node/bun
 * executable and script path (i.e. `process.argv.slice(2)`).
 */
export function parseCliOptions(argv: string[]): CliOptions {
  const program = new Command();
  program
    .name("pxi")
    .description("Phoenix Intelligence (PXI) — a terminal chatbot")
    .option("--host <url>", "Phoenix server base URL (env: PHOENIX_HOST)")
    .option("--api-key <key>", "Phoenix API key (env: PHOENIX_API_KEY)")
    .option(
      "--provider <provider>",
      "Built-in model provider (e.g. ANTHROPIC, OPENAI)",
      DEFAULT_PROVIDER
    )
    .option(
      "--model <name>",
      "Model name for the selected provider",
      DEFAULT_MODEL
    )
    .option(
      "--session-id <id>",
      "Resume an existing session id instead of starting a new one"
    )
    .helpOption("-h, --help", "Show help")
    .version(VERSION, "-v, --version", "Show the PXI version");

  program.parse(argv, { from: "user" });
  const opts = program.opts<{
    host?: string;
    apiKey?: string;
    provider: string;
    model: string;
    sessionId?: string;
  }>();

  return {
    host: opts.host,
    apiKey: opts.apiKey,
    provider: opts.provider as ModelProvider,
    model: opts.model,
    sessionId: opts.sessionId ?? crypto.randomUUID(),
  };
}
