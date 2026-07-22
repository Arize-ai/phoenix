/**
 * Instrumentation hand-off.
 *
 * Lanes, in order of preference: launch a detected coding agent directly
 * (prompt pre-loaded, credentials injected via env), copy the prompt for an
 * agent the user runs themselves, or manual via the quickstart docs. All
 * lanes converge on the trace-verification step — setup's definition of
 * done is API-verified data flow, not agent self-report.
 *
 * The lane is resolved before anything docs-related happens: the docs MCP
 * offer targets exactly the agent being launched, and taking it replaces the
 * `.px/docs` download outright — the agent searches the docs server on demand
 * instead of reading prefetched pages. The clipboard and manual lanes have no
 * known agent to configure, so they keep the prefetch.
 *
 * `--agent` pre-answers the lane, which is what makes an unattended run
 * possible: with no TTY there is no prompt to pick a lane from, and the agent
 * runs in background mode (no TUI to hand the terminal to).
 */

import {
  buildLaunchSpec,
  getCodingAgent,
  probeBinary,
  type AgentRunMode,
  type CodingAgent,
  type CodingAgentId,
} from "../agents/registry";
import * as COPY from "../copy";
import type {
  DocsPrefetchOptions,
  DocsPrefetchResult,
  SelectOption,
  SetupDeps,
} from "../deps";
import { SetupFatalError } from "../errors";
import { buildInstrumentationPrompt } from "../prompts/instrumentationPrompt";
import type { Connection } from "./establishConnection";
import { offerDocsMcp, type DocsMcpResult } from "./offerDocsMcp";
import { prefetchDocs } from "./prefetchDocs";
import { tracesUrl } from "./verifyTraces";

const DEFAULT_LOCAL_ENDPOINT = "http://localhost:6006";

/** Select values are strings ("agent:claude", "clipboard", "manual"). */
type LaneChoice = `agent:${CodingAgent["id"]}` | "clipboard" | "manual";

export interface InstrumentAppArgs {
  authEnabled: boolean;
  /** Started at setup launch so the probes never block this prompt. */
  agentDetection: Promise<CodingAgent[]>;
  /** `--agent`: skip the lane prompt and launch this agent. */
  agent?: CodingAgentId;
  /** `--language`: passed through so the agent skips its own detection. */
  languages: string[];
  /** How to run the agent — see {@link AgentRunMode}. */
  mode: AgentRunMode;
  /** Docs prefetch options; the download runs unless the MCP replaces it. */
  docs: DocsPrefetchOptions;
  /** `--docs-mcp` / `--no-docs-mcp`; undefined means ask (when we can). */
  docsMcp?: boolean;
  headless: boolean;
  /** Gates the prefetch's .gitignore append, as in the docs step itself. */
  isGitRepository: boolean;
}

/** Which lane instrumentation actually took — reported in the summary. */
export type InstrumentationLane =
  | { kind: "agent"; agent: CodingAgentId; exitCode: number }
  | { kind: "clipboard" }
  | { kind: "manual" };

export interface InstrumentAppResult {
  lane: InstrumentationLane;
  /** The docs download, when it ran (the MCP taking its place omits it). */
  docs?: DocsPrefetchResult;
  /** The docs MCP offer, when a launched agent was there to make it to. */
  docsMcp?: DocsMcpResult;
}

export async function instrumentApp(
  deps: Pick<
    SetupDeps,
    "context" | "processes" | "prompter" | "writeClipboard" | "fetchDocs"
  >,
  connection: Connection,
  args: InstrumentAppArgs
): Promise<InstrumentAppResult> {
  const { authEnabled, agentDetection, languages, mode } = args;

  // Resolve the lane before the docs steps: the MCP offer needs to know which
  // agent is doing the work, and only then can "skip the download" be decided.
  let chosenAgent: CodingAgent | undefined;
  let fallbackLane: "clipboard" | "manual" = "manual";

  if (args.agent) {
    // `--agent` short-circuits the lane prompt. The binary is probed rather
    // than taken from the detection sweep so a named-but-missing agent fails
    // with "not on your PATH" instead of silently dropping to another lane.
    const agent = getCodingAgent(args.agent);
    if (!agent) {
      throw new SetupFatalError(COPY.INSTRUMENTATION.unknownAgent(args.agent));
    }
    if (!(await probeBinary(deps, agent.binary))) {
      throw new SetupFatalError(
        COPY.INSTRUMENTATION.agentNotFound(agent.label, agent.binary)
      );
    }
    chosenAgent = agent;
  } else {
    const detectedAgents = await agentDetection;
    const options: Array<SelectOption<LaneChoice>> = [
      ...detectedAgents.map(
        (agent): SelectOption<LaneChoice> => ({
          value: `agent:${agent.id}`,
          label: COPY.INSTRUMENTATION.launchLabel(agent.label),
          hint: COPY.INSTRUMENTATION.launchHint,
        })
      ),
      {
        value: "clipboard",
        label: COPY.INSTRUMENTATION.clipboardLabel,
        hint: COPY.INSTRUMENTATION.clipboardHint,
      },
      {
        value: "manual",
        label: COPY.INSTRUMENTATION.manualLabel,
        hint: COPY.INSTRUMENTATION.manualHint,
      },
    ];
    const choice = await deps.prompter.select<LaneChoice>({
      message: COPY.INSTRUMENTATION.modeMessage,
      options,
    });
    chosenAgent = detectedAgents.find(
      (agent) => choice === `agent:${agent.id}`
    );
    fallbackLane = choice === "clipboard" ? "clipboard" : "manual";
  }

  // The offer is an optimization and never takes setup down with it — that
  // contract lives inside offerDocsMcp, which reports any failure and returns
  // "failed" instead of throwing. Only a user cancel unwinds.
  let docsMcp: DocsMcpResult | undefined;
  if (chosenAgent) {
    docsMcp = await offerDocsMcp(deps, {
      docsMcp: args.docsMcp,
      agent: chosenAgent,
      headless: args.headless,
      docsEnabled: args.docs.enabled,
    });
  } else if (args.docsMcp === true) {
    // An explicit --docs-mcp deserves a word when the lane can't honor it,
    // same as a pinned agent with no MCP install path.
    deps.prompter.line(COPY.DOCS_MCP.noAgentLane);
  }
  const docs =
    docsMcp?.outcome === "configured"
      ? undefined
      : await prefetchDocs(deps, {
          docs: args.docs,
          isGitRepository: args.isGitRepository,
        });

  const prompt = buildInstrumentationPrompt({
    projectName: connection.projectName,
    endpoint: connection.endpoint,
    isDefaultEndpoint: connection.endpoint === DEFAULT_LOCAL_ENDPOINT,
    docs: {
      quickstartPython: COPY.DOCS.quickstartPython,
      quickstartTypeScript: COPY.DOCS.quickstartTypeScript,
      phoenixOtelSetup: COPY.DOCS.phoenixOtelSetup,
      integrationsIndex: COPY.DOCS.integrationsIndex,
    },
    tracesUrl: tracesUrl(connection),
    authEnabled,
    languages,
    // Only advertise the local docs dir when it holds pages — an empty one
    // (docs site down, over-narrow workflow filter) would send the agent to
    // read a directory with nothing in it instead of the web.
    ...(docs?.hasPagesOnDisk ? { localDocsDir: docs.outputDir } : {}),
    ...(docsMcp?.outcome === "configured" ? { docsMcpConfigured: true } : {}),
  });

  if (chosenAgent) {
    const lane = await launchAgent(deps, connection, {
      agent: chosenAgent,
      prompt,
      mode,
    });
    return {
      lane,
      ...(docs ? { docs } : {}),
      ...(docsMcp ? { docsMcp } : {}),
    };
  }

  if (fallbackLane === "clipboard") {
    const copied = await deps.writeClipboard(prompt);
    if (copied) {
      deps.prompter.line(COPY.INSTRUMENTATION.promptCopied);
    } else {
      deps.prompter.line(COPY.INSTRUMENTATION.promptCopyFailed);
      deps.prompter.note(prompt);
    }
    await deps.prompter.select<boolean>({
      message: COPY.INSTRUMENTATION.clipboardDoneMessage,
      options: [
        { value: true, label: COPY.INSTRUMENTATION.clipboardDoneLabel },
      ],
    });
    return { lane: { kind: "clipboard" }, ...(docs ? { docs } : {}) };
  }

  deps.prompter.line(
    COPY.INSTRUMENTATION.manualDocs(COPY.DOCS.instrumentationIndex)
  );
  await deps.prompter.select<boolean>({
    message: COPY.INSTRUMENTATION.manualDoneMessage,
    options: [{ value: true, label: COPY.INSTRUMENTATION.manualDoneLabel }],
  });
  return { lane: { kind: "manual" }, ...(docs ? { docs } : {}) };
}

/**
 * Run the agent with the prompt pre-loaded. A non-zero exit is a warning, not
 * a failure: the agent may have instrumented the app and then exited badly,
 * and trace verification — not the agent's exit code — decides whether setup
 * succeeded.
 */
async function launchAgent(
  deps: Pick<SetupDeps, "context" | "processes" | "prompter">,
  connection: Connection,
  {
    agent,
    prompt,
    mode,
  }: { agent: CodingAgent; prompt: string; mode: AgentRunMode }
): Promise<InstrumentationLane> {
  // Without its TUI *and* without permission bypass, an agent stalls on the
  // first approval it wants, with no terminal to approve it on — the run then
  // dies at the verification timeout with nothing to show. Say so up front.
  if (mode.background && !mode.bypassPermissions) {
    deps.prompter.line(COPY.INSTRUMENTATION.backgroundNeedsYolo(agent.label));
  }
  deps.prompter.line(
    mode.background
      ? COPY.INSTRUMENTATION.launchingBackground(agent.label)
      : COPY.INSTRUMENTATION.launching(agent.label)
  );

  const spec = buildLaunchSpec(agent, {
    prompt,
    cwd: deps.context.cwd,
    connection,
    mode,
  });
  const { exitCode } = await deps.processes.spawnInteractive(spec);
  if (exitCode !== 0) {
    deps.prompter.line(COPY.INSTRUMENTATION.agentExitWarning(agent.label));
  }
  return { kind: "agent", agent: agent.id, exitCode };
}
