/**
 * Render what a setup run did.
 *
 * `pretty` is the human summary; `json`/`raw` are the machine-readable shape an
 * agent reads to learn where it connected, what was written, and — the field
 * that actually matters — whether traces were verified arriving.
 */

import * as COPY from "../setup/copy";
import type { McpSetupReport } from "../setup/mcp/runSetupMcp";
import type { SetupReport } from "../setup/runSetup";
import type { ToolingResult } from "../setup/steps/installTooling";

export type OutputFormat = "pretty" | "json" | "raw";

/** The JSON envelope. Flat and stable — agents key off these names. */
export interface SetupOutput {
  endpoint: string;
  project: string;
  authEnabled: boolean;
  files: string[];
  gitignored: string[];
  tracesUrl: string;
  docs?: {
    outputDir: string;
    workflows: string[];
    pages: number;
    /** Pages that failed to download; the agent reads those from the web. */
    failed: number;
  };
  /** The docs MCP offer; "configured" means the docs prefetch was replaced. */
  docsMcp?: {
    outcome: "configured" | "declined" | "failed";
    agents: string[];
    files: string[];
  };
  instrumentation?: {
    lane: "agent" | "clipboard" | "manual";
    agent?: string;
    /** The agent's own exit code; non-zero does not by itself mean failure. */
    exitCode?: number;
  };
  /** True when the API confirmed a trace arrived after this run started. */
  tracesVerified: boolean;
  tooling?: ToolingResult;
}

export function toSetupOutput(report: SetupReport): SetupOutput {
  const { docs, docsMcp, instrumentation } = report;
  return {
    endpoint: report.connection.endpoint,
    project: report.connection.projectName,
    authEnabled: report.authEnabled,
    files: report.files,
    gitignored: report.gitignored,
    tracesUrl: report.tracesUrl,
    docs: docs && {
      outputDir: docs.outputDir,
      workflows: docs.workflows,
      pages: docs.written,
      failed: docs.failed,
    },
    // The report already omits a skipped offer; the guard also narrows the
    // outcome union for the flat envelope.
    docsMcp:
      docsMcp && docsMcp.outcome !== "skipped"
        ? {
            outcome: docsMcp.outcome,
            agents: docsMcp.agents,
            files: docsMcp.files,
          }
        : undefined,
    instrumentation:
      instrumentation &&
      (instrumentation.kind === "agent"
        ? {
            lane: "agent",
            agent: instrumentation.agent,
            exitCode: instrumentation.exitCode,
          }
        : { lane: instrumentation.kind }),
    tracesVerified: report.tracesVerified === true,
    tooling: report.tooling,
  };
}

/** The one place a format string maps to a rendering. */
function renderJson(value: unknown, format: OutputFormat): string | undefined {
  if (format === "json") {
    return JSON.stringify(value, null, 2);
  }
  if (format === "raw") {
    return JSON.stringify(value);
  }
  return undefined;
}

/** The pretty rendering — what a headless run prints on stdout. */
export function headlessSummary(report: SetupReport): string {
  return [
    `endpoint: ${report.connection.endpoint}`,
    `project: ${report.connection.projectName}`,
    `files: ${report.files.join(", ")}`,
    "",
    COPY.HEADLESS.nextSteps(report.tracesUrl),
  ].join("\n");
}

export interface FormatSetupOutputOptions {
  report: SetupReport;
  format?: OutputFormat;
}

export function formatSetupOutput({
  report,
  format = "pretty",
}: FormatSetupOutputOptions): string {
  return renderJson(toSetupOutput(report), format) ?? headlessSummary(report);
}

// ---------------------------------------------------------------------------
// `px setup mcp`
// ---------------------------------------------------------------------------

/**
 * The pretty rendering — what a headless `px setup mcp` prints on stdout. The
 * `json`/`raw` renderings serialize the {@link McpSetupReport} verbatim, so the
 * report interface itself is the documented JSON envelope.
 */
function mcpHeadlessSummary(report: McpSetupReport): string {
  const lines = [
    `Configured the "${report.serverName}" MCP server with ${report.agent} (${report.scope}).`,
    `url: ${report.url}`,
    `auth: ${report.auth}`,
  ];
  if (report.file) {
    lines.push(`config: ${report.file}`);
  }
  return lines.join("\n");
}

export interface FormatMcpSetupOutputOptions {
  report: McpSetupReport;
  format?: OutputFormat;
}

export function formatMcpSetupOutput({
  report,
  format = "pretty",
}: FormatMcpSetupOutputOptions): string {
  return renderJson(report, format) ?? mcpHeadlessSummary(report);
}

export interface FormatToolingOutputOptions {
  tooling: ToolingResult;
  format?: OutputFormat;
}

/** `px setup skills` reports only what the installs did. */
export function formatToolingOutput({
  tooling,
  format = "pretty",
}: FormatToolingOutputOptions): string {
  return (
    renderJson({ tooling }, format) ??
    [`px CLI: ${tooling.cli}`, `skills: ${tooling.skills}`].join("\n")
  );
}
