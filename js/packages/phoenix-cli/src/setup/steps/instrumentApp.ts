/**
 * Instrumentation hand-off.
 *
 * Lanes, in order of preference: launch a detected coding agent directly
 * (prompt pre-loaded, credentials injected via env), copy the prompt for an
 * agent the user runs themselves, or manual via the quickstart docs. All
 * lanes converge on the trace-verification step — setup's definition of
 * done is API-verified data flow, not agent self-report.
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
import type { DocsPrefetchResult, SelectOption, SetupDeps } from "../deps";
import { SetupFatalError } from "../errors";
import { buildInstrumentationPrompt } from "../prompts/instrumentationPrompt";
import type { Connection } from "./establishConnection";
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
  /** Where the prefetched docs landed, when the docs step ran. */
  docs?: DocsPrefetchResult;
}

/** Which lane instrumentation actually took — reported in the summary. */
export type InstrumentationLane =
  | { kind: "agent"; agent: CodingAgentId; exitCode: number }
  | { kind: "clipboard" }
  | { kind: "manual" };

export async function instrumentApp(
  deps: Pick<
    SetupDeps,
    "context" | "processes" | "prompter" | "writeClipboard"
  >,
  connection: Connection,
  args: InstrumentAppArgs
): Promise<InstrumentationLane> {
  const { authEnabled, agentDetection, languages, mode } = args;
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
    ...(args.docs?.hasPagesOnDisk ? { localDocsDir: args.docs.outputDir } : {}),
  });

  // `--agent` short-circuits the lane prompt. The binary is probed rather
  // than taken from the detection sweep so a named-but-missing agent fails
  // with "not on your PATH" instead of silently dropping to another lane.
  if (args.agent) {
    const agent = getCodingAgent(args.agent);
    if (!agent) {
      throw new SetupFatalError(COPY.INSTRUMENTATION.unknownAgent(args.agent));
    }
    if (!(await probeBinary(deps, agent.binary))) {
      throw new SetupFatalError(
        COPY.INSTRUMENTATION.agentNotFound(agent.label, agent.binary)
      );
    }
    return launchAgent(deps, connection, { agent, prompt, mode });
  }

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

  const chosenAgent = detectedAgents.find(
    (agent) => choice === `agent:${agent.id}`
  );
  if (chosenAgent) {
    return launchAgent(deps, connection, { agent: chosenAgent, prompt, mode });
  }

  if (choice === "clipboard") {
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
    return { kind: "clipboard" };
  }

  deps.prompter.line(
    COPY.INSTRUMENTATION.manualDocs(COPY.DOCS.instrumentationIndex)
  );
  await deps.prompter.select<boolean>({
    message: COPY.INSTRUMENTATION.manualDoneMessage,
    options: [{ value: true, label: COPY.INSTRUMENTATION.manualDoneLabel }],
  });
  return { kind: "manual" };
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
