/**
 * Offer to connect the Phoenix docs MCP server to the coding agent taking the
 * hand-off, instead of downloading the docs.
 *
 * Taking the offer is the fast path: one small config step replaces the
 * ~100-page `.px/docs` download, and the agent then searches the docs server
 * on demand — pulling only the sections it needs instead of reading whole
 * pages. Declining (or any failure) degrades to the docs prefetch, which is
 * what setup did before this step existed.
 *
 * The offer is an optimization and must never take setup down with it:
 * whatever goes wrong (an agent CLI whose flags drifted, a config format we
 * no longer understand), this step reports it, returns a "failed" result, and
 * the caller carries on with the docs download. The only throw that leaves
 * this function is a user cancel.
 *
 * The offer targets exactly one agent — the lane the user chose (or `--agent`
 * pinned) — so setup never sprays MCP config for agents that aren't doing the
 * work. How the entry lands is the agent's own affair ({@link DocsMcpInstall}):
 * agents with an MCP subcommand register it through their own CLI, the rest
 * get a merge into their documented config file. Headless runs never touch
 * agent config unless `--docs-mcp` asked for it.
 */

import * as path from "node:path";

import { DOCS_MCP_SERVER_URL, type CodingAgent } from "../agents/registry";
import * as COPY from "../copy";
import type { SetupDeps } from "../deps";
import { SetupCancelledError } from "../errors";
import { selectBoolean } from "../ui/selectBoolean";
import { writeMcpConfig } from "../util/mcpConfig";

export type DocsMcpOutcome = "configured" | "declined" | "skipped" | "failed";

/** What the offer did — reported in the setup summary. */
export interface DocsMcpResult {
  outcome: DocsMcpOutcome;
  /** Agents whose config now names the server. */
  agents: CodingAgent["id"][];
  /** Repo-relative config files written (empty for a CLI-side install). */
  files: string[];
}

const SKIPPED: DocsMcpResult = { outcome: "skipped", agents: [], files: [] };

/** Registering a server is one config write; a slow CLI start is still fine. */
const CLI_INSTALL_TIMEOUT_MS = 30_000;

export interface OfferDocsMcpArgs {
  /** `--docs-mcp` / `--no-docs-mcp`; undefined means ask (when we can). */
  docsMcp?: boolean;
  /** The agent taking the hand-off — the only one the offer configures. */
  agent: CodingAgent;
  headless: boolean;
  /**
   * Whether the docs prefetch would actually run on decline/failure — with
   * `--no-docs` it won't, and the offer must not promise a download.
   */
  docsEnabled: boolean;
}

export async function offerDocsMcp(
  deps: Pick<SetupDeps, "context" | "prompter" | "processes">,
  args: OfferDocsMcpArgs
): Promise<DocsMcpResult> {
  try {
    return await runOffer(deps, args);
  } catch (error) {
    if (error instanceof SetupCancelledError) {
      throw error;
    }
    return reportFailure(
      deps,
      args,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/** The single failure path: say what broke, say what happens instead. */
function reportFailure(
  deps: Pick<SetupDeps, "prompter">,
  { agent, docsEnabled }: OfferDocsMcpArgs,
  reason: string
): DocsMcpResult {
  deps.prompter.line(COPY.DOCS_MCP.failedFor(agent.label, reason));
  deps.prompter.line(
    docsEnabled ? COPY.DOCS_MCP.fallback : COPY.DOCS_MCP.fallbackWithoutDownload
  );
  return { outcome: "failed", agents: [], files: [] };
}

async function runOffer(
  deps: Pick<SetupDeps, "context" | "prompter" | "processes">,
  args: OfferDocsMcpArgs
): Promise<DocsMcpResult> {
  const { docsMcp, agent, headless, docsEnabled } = args;
  if (docsMcp === false) {
    return SKIPPED;
  }

  const install = agent.docsMcpInstall;
  if (!install) {
    // Only worth a line when the caller asked by flag — a pinned agent with
    // no MCP install path (Codex) would otherwise silently ignore it.
    if (docsMcp === true) {
      deps.prompter.line(COPY.DOCS_MCP.unsupported(agent.label));
    }
    return SKIPPED;
  }

  // An unattended run never edits agent config unless --docs-mcp said so.
  if (docsMcp === undefined && headless) {
    return SKIPPED;
  }

  const optedIn =
    docsMcp ??
    (await selectBoolean({
      prompter: deps.prompter,
      message: COPY.DOCS_MCP.message(agent.label),
      yesLabel: COPY.DOCS_MCP.yes,
      yesHint: COPY.DOCS_MCP.yesHint,
      noLabel: docsEnabled ? COPY.DOCS_MCP.no : COPY.DOCS_MCP.noWithoutDownload,
      noHint: docsEnabled
        ? COPY.DOCS_MCP.noHint
        : COPY.DOCS_MCP.noWithoutDownloadHint,
    }));
  if (!optedIn) {
    return { outcome: "declined", agents: [], files: [] };
  }

  if (install.kind === "cli") {
    const exec = (execArgs: string[]) =>
      deps.processes.exec({
        command: agent.binary,
        args: execArgs,
        cwd: deps.context.cwd,
        timeoutMs: CLI_INSTALL_TIMEOUT_MS,
      });

    // `add` first: the clean path is one registration plus the read-back.
    // Only when `add` is refused AND the agent's own listing shows an entry
    // under our name is that entry removed and the add retried — removing
    // before knowing the add works would destroy a working registration
    // that a failed retry can't put back.
    let added = await exec(install.addArgs(DOCS_MCP_SERVER_URL));
    if (added.exitCode !== 0) {
      const existing = await exec(install.verifyArgs);
      if (existing.exitCode !== 0) {
        return reportFailure(
          deps,
          args,
          added.stderr.trim() || `exit code ${added.exitCode}`
        );
      }
      await exec(install.removeArgs);
      added = await exec(install.addArgs(DOCS_MCP_SERVER_URL));
      if (added.exitCode !== 0) {
        return reportFailure(
          deps,
          args,
          added.stderr.trim() || `exit code ${added.exitCode}`
        );
      }
    }
    // Don't trust the add's exit code alone: read the entry back through the
    // agent's own listing, so a drifted command that "succeeds" without
    // registering anything is caught here instead of silently costing the
    // agent its docs.
    const verified = await exec(install.verifyArgs);
    if (verified.exitCode !== 0) {
      return reportFailure(deps, args, COPY.DOCS_MCP.verifyFailed);
    }
    deps.prompter.line(COPY.DOCS_MCP.configuredCli(agent.label));
    return { outcome: "configured", agents: [agent.id], files: [] };
  }

  // A write that throws (unparseable existing file, permissions) is handled
  // by the catch-all in offerDocsMcp.
  writeMcpConfig({
    filePath: path.join(deps.context.cwd, install.relativePath),
    displayPath: install.relativePath,
    patch: install.patch(DOCS_MCP_SERVER_URL),
    ...(install.createDefaults
      ? { createDefaults: install.createDefaults }
      : {}),
  });
  deps.prompter.line(COPY.DOCS_MCP.configured([install.relativePath]));
  return {
    outcome: "configured",
    agents: [agent.id],
    files: [install.relativePath],
  };
}
