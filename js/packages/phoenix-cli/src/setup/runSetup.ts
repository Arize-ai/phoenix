/**
 * The setup step sequence, and nothing else.
 *
 * All effects flow through `SetupDeps`; all strings live in `copy.ts`;
 * cancellation unwinds via `SetupCancelledError` to the command handler.
 *
 * Three entry points, composed from the same steps:
 *   - `runSetup`      — the whole flow (`px setup`)
 *   - `runInstrument` — register, then instrument and verify (`px setup instrument`)
 *   - `runSkills`     — the tooling installs alone (`px setup skills`)
 * Each returns a {@link SetupReport}, which the command layer renders in the
 * requested `--format`.
 */

import {
  type CodingAgent,
  detectCodingAgents,
  probeGlobalBinary,
} from "./agents/registry";
import * as COPY from "./copy";
import type { DocsPrefetchResult, SetupDeps } from "./deps";
import { SetupCancelledError } from "./errors";
import type { SetupInputs } from "./options";
import { assertAgentForHeadlessInstrument } from "./options";
import { chooseEndpoint } from "./steps/chooseEndpoint";
import { confirmGitSafety } from "./steps/confirmGitSafety";
import type { Connection } from "./steps/establishConnection";
import { establishConnection } from "./steps/establishConnection";
import {
  offerToolingInstalls,
  type ToolingResult,
} from "./steps/installTooling";
import { instrumentApp, type InstrumentationLane } from "./steps/instrumentApp";
import type { DocsMcpResult } from "./steps/offerDocsMcp";
import { offerPxProfile } from "./steps/offerPxProfile";
import {
  hasSpansInSkewWindow,
  waitForFirstTrace,
  tracesUrl,
} from "./steps/verifyTraces";
import { ENV_FILE_NAME, writeEnvFile } from "./steps/writeEnvFile";

/** Everything a run did, in the shape the summary and `--format json` print. */
export interface SetupReport {
  connection: Connection;
  authEnabled: boolean;
  headless: boolean;
  /** Files setup wrote into the repo. */
  files: string[];
  /** Paths appended to a .gitignore. */
  gitignored: string[];
  docs?: DocsPrefetchResult;
  /** The docs MCP offer, when it was made (configured replaces `docs`). */
  docsMcp?: DocsMcpResult;
  instrumentation?: InstrumentationLane;
  /** True once the API confirmed a trace arrived after this run started. */
  tracesVerified?: boolean;
  tooling?: ToolingResult;
  tracesUrl: string;
}

/**
 * Detect the installed agents — but only when the lane is still open. `--agent`
 * pins it, and the pinned agent probes its own binary, so the sweep's four
 * subprocess spawns would be thrown away. Every headless instrumentation run
 * names an agent, so that is exactly where the waste would land.
 */
function detectAgentsUnlessPinned(
  deps: SetupDeps,
  inputs: SetupInputs
): Promise<CodingAgent[]> {
  return inputs.agent ? Promise.resolve([]) : detectCodingAgents(deps);
}

/** `px setup` — the whole flow. */
export async function runSetup(
  deps: SetupDeps,
  inputs: SetupInputs
): Promise<SetupReport> {
  // Started before the first prompt so the probes finish behind it; awaited
  // by the instrumentation and tooling steps.
  const agentDetection = detectAgentsUnlessPinned(deps, inputs);
  // Probed with package-runner bin dirs stripped from PATH — under
  // `npx @arizeai/phoenix-cli setup`, the package's own `px` shim must not
  // masquerade as a global install and suppress the CLI-install offer.
  const pxOnPath = probeGlobalBinary(deps, "px");

  if (!inputs.headless) {
    deps.prompter.intro(COPY.INTRO);
  }

  const report = await registerAndInstrument(deps, inputs, { agentDetection });

  // A headless run stops here: the tooling offers are prompts, and its stdout
  // belongs to the summary.
  if (inputs.headless) {
    return report;
  }

  // Tooling opt-ins come after the verified-trace moment so nothing stands
  // between launch and first trace: point px at this project, then install the
  // CLI and skills so the user (and their coding agent) can look at the traces
  // now flowing.
  await offerPxProfile(deps, {
    connection: report.connection,
    settingsPath: deps.context.settingsPath,
  });
  const tooling = await offerToolingInstalls(deps, {
    pxOnPath,
    skills: inputs.skills,
    canPrompt: true,
  });

  deps.prompter.note(
    report.authEnabled
      ? COPY.PRODUCTION.bodyAuthOn
      : COPY.PRODUCTION.bodyAuthOff,
    COPY.PRODUCTION.title
  );
  // Untitled: the outro below already says it, and closes the rail.
  deps.prompter.note(COPY.OUTRO_BODY);
  deps.prompter.outro(COPY.OUTRO_TITLE);

  return { ...report, tooling };
}

/**
 * `px setup instrument` — the instrumentation slice, re-runnable on a repo that
 * is already registered. Registration still runs: it is idempotent, and it is
 * what produces the connection the agent and the verification step need.
 */
export async function runInstrument(
  deps: SetupDeps,
  resolved: SetupInputs
): Promise<SetupReport> {
  // This lane instruments by definition, so it never passes `--instrument` for
  // `resolveSetupInputs` to have guarded — check the headless rule here.
  assertAgentForHeadlessInstrument(resolved);
  const inputs = { ...resolved, instrument: true };
  const agentDetection = detectAgentsUnlessPinned(deps, inputs);

  if (!inputs.headless) {
    deps.prompter.intro(COPY.INTRO_INSTRUMENT);
  }
  const report = await registerAndInstrument(deps, inputs, { agentDetection });
  if (!inputs.headless) {
    deps.prompter.outro(COPY.OUTRO_TITLE);
  }
  return report;
}

/** `px setup skills` — the tooling installs alone; no connection needed. */
export async function runSkills(
  deps: SetupDeps,
  inputs: SetupInputs
): Promise<ToolingResult> {
  const pxOnPath = probeGlobalBinary(deps, "px");

  if (!inputs.headless) {
    deps.prompter.intro(COPY.INTRO_SKILLS);
  }
  const tooling = await offerToolingInstalls(deps, {
    pxOnPath,
    skills: inputs.skills,
    canPrompt: !inputs.headless,
  });
  if (!inputs.headless) {
    deps.prompter.outro(COPY.OUTRO_TITLE);
  }
  return tooling;
}

/**
 * Register, then — when asked — prefetch docs, hand off to the agent, and
 * verify traces. The shared spine of `px setup` and `px setup instrument`.
 */
async function registerAndInstrument(
  deps: SetupDeps,
  inputs: SetupInputs,
  { agentDetection }: { agentDetection: Promise<CodingAgent[]> }
): Promise<SetupReport> {
  const registration = await register(deps, inputs);
  const { connection, authEnabled, gitignoreAppended } = registration;

  const base: SetupReport = {
    connection,
    authEnabled,
    headless: inputs.headless,
    files: [ENV_FILE_NAME],
    gitignored: gitignoreAppended,
    tracesUrl: tracesUrl(connection),
  };

  if (!inputs.instrument) {
    return base;
  }

  const startedAt = deps.clock.now();
  // Any span already visible inside the clock-skew window predates this run —
  // verification must then require spans strictly after the start time, or a
  // pre-existing trace would falsely verify the hand-off.
  const hadRecentSpans = await hasSpansInSkewWindow(deps, connection, {
    sinceMs: startedAt,
  });

  // The docs steps live inside instrumentApp, after its lane choice: the docs
  // MCP offer targets exactly the agent doing the hand-off, and taking it
  // replaces the `.px/docs` download outright. Both still run behind
  // registration's git-safety gate, which this call comes after.
  const {
    lane: instrumentation,
    docs,
    docsMcp,
  } = await instrumentApp(deps, connection, {
    authEnabled,
    agentDetection,
    agent: inputs.agent,
    languages: inputs.languages,
    mode: {
      background: inputs.background,
      bypassPermissions: inputs.bypassPermissions,
    },
    docs: inputs.docs,
    docsMcp: inputs.docsMcp,
    headless: inputs.headless,
    isGitRepository: registration.isGitRepository,
  });

  // The return value is setup's definition of done — a trace the API confirmed
  // arriving, not the agent's own claim that it finished. It is reported, not
  // thrown on: the connection and hand-off files are real work worth keeping
  // even when no trace showed up.
  const tracesVerified = await waitForFirstTrace(deps, connection, {
    sinceMs: startedAt,
    allowClockSkew: !hadRecentSpans,
    headless: inputs.headless,
  });

  return {
    ...base,
    ...(docs ? { docs } : {}),
    ...(docsMcp && docsMcp.outcome !== "skipped" ? { docsMcp } : {}),
    // The MCP config files and the docs step's own gitignore appends have to
    // fold into the report, or it under-states what setup touched.
    files: [...base.files, ...(docsMcp?.files ?? [])],
    gitignored: [...base.gitignored, ...(docs?.gitignoreAppended ?? [])],
    instrumentation,
    tracesVerified,
  };
}

interface Registration {
  connection: Connection;
  authEnabled: boolean;
  gitignoreAppended: string[];
  isGitRepository: boolean;
}

/**
 * Git safety, endpoint, connection, env file — the part every lane shares, and
 * all a registration-only run performs.
 */
async function register(
  deps: SetupDeps,
  inputs: SetupInputs
): Promise<Registration> {
  const { headless } = inputs;

  const git = await confirmGitSafety(deps, { headless });
  if (!git.proceed) {
    throw new SetupCancelledError();
  }

  // The hidden --api-url dev flag never reaches this endpoint — it is applied
  // as the client's base URL in buildDefaultDeps, so API traffic is rerouted
  // while hand-off files, the px profile, and traces URLs keep the endpoint
  // resolved here.
  const endpointChoice = await chooseEndpoint(deps, {
    presetEndpoint: inputs.endpoint,
    headless,
  });

  const connection = await establishConnection(deps, {
    endpoint: endpointChoice.endpoint,
    authEnabled: endpointChoice.authEnabled,
    inputs,
  });

  const envFile = writeEnvFile(deps, connection, {
    isGitRepository: git.isGitRepository,
  });

  if (!headless) {
    deps.prompter.line(COPY.ENV_FILE.wrote([ENV_FILE_NAME]));
    if (envFile.gitignoreAppended.length > 0) {
      deps.prompter.line(COPY.ENV_FILE.gitignored(envFile.gitignoreAppended));
    }
  }

  return {
    connection,
    authEnabled: endpointChoice.authEnabled,
    gitignoreAppended: envFile.gitignoreAppended,
    isGitRepository: git.isGitRepository,
  };
}
