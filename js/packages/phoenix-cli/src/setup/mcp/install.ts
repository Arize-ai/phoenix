/**
 * Execute one MCP install action — run the agent's `mcp add`, or merge the
 * server entry into its config file.
 *
 * The CLI path mirrors the docs-MCP install in `../steps/offerDocsMcp.ts`: add
 * first, and only when the add is refused *and* the agent's own listing shows
 * an entry under our name do we remove-then-retry — removing before knowing the
 * add works would destroy a working registration a failed retry can't put back.
 * The read-back (`verifyArgs`) is the drift guard: an add whose flags changed
 * meaning while still exiting 0 is caught by the entry not showing up.
 *
 * This never throws for an install that simply didn't take: it returns a
 * `failed` result with a reason, and the caller decides how loud to be.
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
  // Every exec runs in the repo root: a `--scope project` add must land the
  // config in this repo, not wherever px happened to be launched from.
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
  if (added.exitCode !== 0) {
    // Retry through remove only when we can both confirm an entry exists and
    // remove it — otherwise a refused add is just reported.
    if (action.removeArgs && action.verifyArgs) {
      const existing = await exec(action.verifyArgs);
      if (existing.exitCode !== 0) {
        return fail(added.stderr.trim() || `exit code ${added.exitCode}`);
      }
      await exec(action.removeArgs);
      added = await exec(action.addArgs(url, headers));
      if (added.exitCode !== 0) {
        return fail(added.stderr.trim() || `exit code ${added.exitCode}`);
      }
    } else {
      return fail(added.stderr.trim() || `exit code ${added.exitCode}`);
    }
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
    absolutePath: action.path(installContext),
    patch: action.patch(url, headers),
    ...(action.createDefaults ? { createDefaults: action.createDefaults } : {}),
  });
  return { outcome: "configured", file: action.displayPath(installContext) };
}
