/**
 * Write the hand-off file.
 *
 * Writes `.env.phoenix` into cwd (deliberately not the repo root — bounded
 * blast radius in monorepos), mode 0600, then ensures it is gitignored. The
 * file emits the SDK env var names — it configures the user's app, not px.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import * as COPY from "../copy";
import type { SetupDeps } from "../deps";
import { ensureGitignored } from "../util/gitignoreCoverage";
import type { Connection } from "./establishConnection";

export const ENV_FILE_NAME = ".env.phoenix";

/**
 * Double-quote a value for a `source`-able env file, escaping the characters
 * the shell still interprets inside double quotes. Project names may contain
 * spaces (the default is the cwd basename), and dotenv-style loaders strip
 * the same quotes.
 */
function quoteEnvValue(value: string): string {
  return `"${value.replace(/[\\"$`]/g, (char) => `\\${char}`)}"`;
}

export function renderEnvFile(connection: Connection, isoDate: string): string {
  const lines = [
    COPY.ENV_FILE.fileHeaderEnv(isoDate),
    `PHOENIX_COLLECTOR_ENDPOINT=${quoteEnvValue(connection.endpoint)}`,
    `PHOENIX_PROJECT_NAME=${quoteEnvValue(connection.projectName)}`,
  ];
  if (connection.apiKey) {
    lines.push(`PHOENIX_API_KEY=${quoteEnvValue(connection.apiKey)}`);
  }
  return `${lines.join("\n")}\n`;
}

export interface WriteEnvFileResult {
  envFilePath: string;
  gitignoreAppended: string[];
}

export function writeEnvFile(
  deps: Pick<SetupDeps, "clock" | "context">,
  connection: Connection,
  { isGitRepository }: { isGitRepository: boolean }
): WriteEnvFileResult {
  const isoDate = new Date(deps.clock.now()).toISOString();
  const envFilePath = path.join(deps.context.cwd, ENV_FILE_NAME);

  fs.writeFileSync(envFilePath, renderEnvFile(connection, isoDate), {
    encoding: "utf-8",
    mode: 0o600,
  });
  // Rewrites of an existing file keep its old mode — enforce 0600 anyway.
  fs.chmodSync(envFilePath, 0o600);

  // Applied in the auth-off case too: the file may later gain a key.
  const { appended } = ensureGitignored({
    directory: deps.context.cwd,
    filenames: [ENV_FILE_NAME],
    isGitRepository,
  });

  return { envFilePath, gitignoreAppended: appended };
}
