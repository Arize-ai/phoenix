/**
 * Execute one MCP install action — run the agent's `mcp add`, or merge the
 * server entry into its config file.
 *
 * The CLI path adds first, and only remove-then-retries when the add is refused
 * *and* the agent's own listing already shows an entry under our name — removing
 * before the add is known to work could destroy a registration a failed retry
 * can't restore. The `verifyArgs` read-back guards against drift: an add whose
 * flags changed meaning while still exiting 0 shows up as a missing entry.
 *
 * Never throws when an install simply didn't take — returns a `failed` result
 * with a reason for the caller to handle.
 */

import type { SetupDeps } from "../deps";
import { writeMcpConfig } from "../util/mcpConfig";
import type { McpHeader, McpInstallAction, McpInstallContext } from "./agents";

export type McpInstallOutcome = "configured" | "failed";

export interface McpInstallResult {
  outcome: McpInstallOutcome;
  /** The config file written (repo-relative or `~/…`), for file-based installs. */
  file?: string;
  /** Why the install failed, when it did. */
  reason?: string;
}

/** Registering a server is one config write; a slow CLI start is still fine. */
const CLI_INSTALL_TIMEOUT_MS = 30_000;

export interface RunMcpInstallArgs {
  action: McpInstallAction;
  /** The Phoenix MCP URL (endpoint + `/mcp`). */
  url: string;
  /** Headers for the API-key bearer fallback; empty for OAuth. */
  headers: McpHeader[];
  /** Home and repo-root the file paths resolve against. */
  installContext: McpInstallContext;
}

export async function runMcpInstall(
  deps: Pick<SetupDeps, "processes">,
  { action, url, headers, installContext }: RunMcpInstallArgs
): Promise<McpInstallResult> {
  try {
    return action.kind === "cli"
      ? await runCliInstall(deps, action, { url, headers, installContext })
      : runFileInstall(action, { url, headers, installContext });
  } catch (error) {
    return {
      outcome: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runCliInstall(
  deps: Pick<SetupDeps, "processes">,
  action: Extract<McpInstallAction, { kind: "cli" }>,
  {
    url,
    headers,
    installContext,
  }: Pick<RunMcpInstallArgs, "url" | "headers" | "installContext">
): Promise<McpInstallResult> {
  // Every exec runs in the install context's cwd — the repo root for a local
  // install, so a `--scope project` add lands the config in this repo, not
  // wherever px happened to be launched from.
  const exec = (args: string[]) =>
    deps.processes.exec({
      command: action.binary,
      args,
      cwd: installContext.cwd,
      timeoutMs: CLI_INSTALL_TIMEOUT_MS,
    });

  const fail = (reason: string): McpInstallResult => ({
    outcome: "failed",
    reason,
  });

  let added = await exec(action.addArgs(url, headers));
  // Retry through remove only when we can both confirm an entry exists and
  // remove it — otherwise a refused add is just reported.
  if (
    added.exitCode !== 0 &&
    action.removeArgs &&
    action.verifyArgs &&
    (await exec(action.verifyArgs)).exitCode === 0
  ) {
    await exec(action.removeArgs);
    added = await exec(action.addArgs(url, headers));
  }
  if (added.exitCode !== 0) {
    return fail(added.stderr.trim() || `exit code ${added.exitCode}`);
  }

  // Trust the add's exit code only when the agent has no listing to read back
  // from; otherwise confirm the entry actually registered.
  if (action.verifyArgs) {
    const verified = await exec(action.verifyArgs);
    if (verified.exitCode !== 0) {
      return fail("the server did not show up in the agent's MCP list");
    }
  }
  return { outcome: "configured" };
}

function runFileInstall(
  action: Extract<McpInstallAction, { kind: "file" }>,
  {
    url,
    headers,
    installContext,
  }: Pick<RunMcpInstallArgs, "url" | "headers" | "installContext">
): McpInstallResult {
  writeMcpConfig({
    filePath: action.path(installContext),
    displayPath: action.displayPath(installContext),
    patch: action.patch(url, headers),
    ...(action.createDefaults ? { createDefaults: action.createDefaults } : {}),
  });
  return { outcome: "configured", file: action.displayPath(installContext) };
}
