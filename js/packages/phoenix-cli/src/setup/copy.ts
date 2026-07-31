/**
 * ALL user-facing strings for setup, grouped by the step that emits
 * them. Control flow references copy; copy never references control flow.
 * Keep prose here so wording changes never touch step logic.
 */

// The one allowed inbound name: the MCP server's registered name must read
// the same in the prose as in the agent configs it lands in.
import { DOCS_MCP_SERVER_NAME } from "./agents/registry";

// ---------------------------------------------------------------------------
// Docs contract — the only doc URLs setup emits.
// ---------------------------------------------------------------------------

export const DOCS = {
  /** Agent-facing quickstart, Python (arize-phoenix-otel). */
  quickstartPython:
    "https://arize.com/docs/phoenix/get-started/get-started-tracing",
  /** Agent-facing quickstart, TypeScript (@arizeai/phoenix-otel). */
  quickstartTypeScript:
    "https://arize.com/docs/phoenix/get-started/ts-get-started-tracing",
  /** phoenix.otel register() reference for custom setups. */
  phoenixOtelSetup:
    "https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/setup-using-phoenix-otel",
  /** Per-framework/provider auto-instrumentation guides. */
  integrationsIndex: "https://arize.com/docs/phoenix/integrations",
  /** Linked from the verification step. */
  troubleshooting:
    "https://arize.com/docs/phoenix/tracing/concepts-tracing/faqs-tracing",
  /** Linked from the manual lane and headless output. */
  instrumentationIndex: "https://arize.com/docs/phoenix/quickstart",
} as const;

export const SUPPORT_LINKS = [
  `Docs:            ${DOCS.instrumentationIndex}`,
  `Troubleshooting: ${DOCS.troubleshooting}`,
  "Issues:          https://github.com/Arize-ai/phoenix/issues",
  "Community:       https://arize-ai.slack.com",
].join("\n");

// ---------------------------------------------------------------------------
// Shell / lifecycle
// ---------------------------------------------------------------------------

export const INTRO = "Phoenix tracing setup";

export const INTRO_INSTRUMENT =
  "Phoenix setup — instrument this app and verify traces arrive.";

export const INTRO_SKILLS = "Install agent skills";

export const CANCEL_OUTRO = [
  "Setup cancelled. Nothing else was changed.",
  "",
  SUPPORT_LINKS,
].join("\n");

export const OUTRO_TITLE = "You're set up.";

export const OUTRO_BODY = SUPPORT_LINKS;

// ---------------------------------------------------------------------------
// Confirm git safety
// ---------------------------------------------------------------------------

export const GIT = {
  notARepoMessage: "This directory is not a git repository. Continue anyway?",
  notARepoYes: "Yes, continue without git",
  notARepoNo: "No, stop here (recommended)",
  notARepoNoHint:
    "Setup may edit files via a coding agent — git is the undo button.",
  notARepoYesHint: "You will have no easy way to review or revert changes.",
  dirtyMessage: (fileCount: number) =>
    `You have ${fileCount} uncommitted change${fileCount === 1 ? "" : "s"}. Continue anyway?`,
  dirtyYes: "Yes, continue with a dirty tree",
  dirtyNo: "No, stop here so I can commit first (recommended)",
  dirtyNoHint: "A clean tree keeps agent edits separate from your own edits.",
  dirtyYesHint: "Agent edits will be tangled with your uncommitted work.",
  dirtyFileListTitle: "Uncommitted changes",
  andMore: (count: number) => `…and ${count} more`,
  headlessDirty:
    "Refusing to run headless in a dirty git tree. Commit or stash your changes and re-run.",
  headlessNotARepo:
    "Refusing to run headless outside a git repository. Run `git init` (or run setup interactively) and re-run.",
  stopped: "Stopped. Commit your work, then re-run `px setup`.",
} as const;

// ---------------------------------------------------------------------------
// Choose endpoint
// ---------------------------------------------------------------------------

export const ENDPOINT = {
  selectMessage: "Where is your Phoenix instance running?",
  localLabel: "Local — http://localhost:6006",
  localHint: "recommended if you just ran `phoenix serve`",
  remoteLabel: "Remote — paste your instance URL",
  remoteHint: "any Phoenix instance reachable by URL",
  remoteUrlMessage: "Phoenix instance URL",
  remoteUrlInvalid:
    "Enter a full http:// or https:// URL, e.g. https://phoenix.example.com",
  probing: (endpoint: string) => `Checking ${endpoint}…`,
  unexpectedBody: "unexpected response body",
  unreachable: (endpoint: string) =>
    [
      `Could not reach a Phoenix instance at ${endpoint}.`,
      "If it's local, is `phoenix serve` running? If it's remote, check the",
      "URL and that you can reach it from this machine (VPN?).",
    ].join("\n"),
  notPhoenix: (endpoint: string, detail: string) =>
    [
      `${endpoint} responded, but not like a Phoenix instance (${detail}).`,
      "Double-check the URL — it should be the Phoenix root URL, without",
      "a path like /projects.",
    ].join("\n"),
  retryMessage: "Try a different URL?",
  retryYes: "Yes, enter a URL again",
  retryNo: "No, exit setup",
  gaveUp: [
    "Couldn't establish a connection after several attempts.",
    `Setup docs: ${DOCS.instrumentationIndex}`,
  ].join("\n"),
  authOn: "Authentication is enabled on this instance.",
  authOff: "Authentication is off — no API key needed.",
  headlessUnreachable: (endpoint: string) =>
    `Could not reach Phoenix at ${endpoint}. Is it running and reachable from this machine?`,
  headlessNeedsEndpoint: [
    "Missing endpoint. Provide one of:",
    "  --endpoint <url>",
    "  PHOENIX_HOST=<url> (or PHOENIX_COLLECTOR_ENDPOINT=<url>)",
  ].join("\n"),
} as const;

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export const CONNECT = {
  projectNameMessage: "Phoenix project name for this app's traces",
  projectNameInvalid:
    "Project names can't contain '/', '?', or '#' and can't be empty.",
  usingProject: (name: string) =>
    `Using project "${name}" — Phoenix creates it when the first trace arrives.`,
  connectFailed: (detail: string) => `Couldn't connect to Phoenix (${detail}).`,
  headlessNeedsProject: [
    "Missing project. Provide one of:",
    "  --project <name>",
    "  PHOENIX_PROJECT=<name> (or PHOENIX_PROJECT_NAME=<name>)",
  ].join("\n"),
  headlessNeedsApiKey: [
    "This Phoenix instance has authentication enabled. Headless setup needs an API key. Provide:",
    "  PHOENIX_API_KEY=<key>",
    "and a project via --project or PHOENIX_PROJECT.",
  ].join("\n"),
  headlessAuthRejected: "The API key was rejected. Check PHOENIX_API_KEY.",
} as const;

// ---------------------------------------------------------------------------
// Auth-on credential entry
// ---------------------------------------------------------------------------

export const CREDENTIALS = {
  methodMessage: "How do you want to connect to Phoenix?",
  loginLabel: "Log in with your browser (recommended)",
  loginHint: "approve once in Phoenix; setup creates an API key for you",
  pasteLabel: "Paste an existing API key",
  pasteHint: "create or copy one in Phoenix under Settings",
  authorizationUrl: (url: string) =>
    [
      "Complete the login in your browser. If it didn't open, visit:",
      url,
      "",
      "Press Ctrl-C to skip and paste an API key instead.",
    ].join("\n"),
  browserOpenFailed: (detail: string) =>
    `Couldn't open a browser (${detail}). Open the URL above by hand, or press Ctrl-C to paste an API key instead.`,
  keyCreated: (name: string) =>
    `Logged in — created API key "${name}" for this project.`,
  // Covers both ways out of the login: declining consent, and Ctrl-C.
  loginCancelled: "Login didn't finish — paste an API key instead.",
  loginFailed: (detail: string) =>
    `Browser login didn't complete (${detail}) — paste an API key instead.`,
  keyCreateFailed: (detail: string) =>
    `Logged in, but couldn't create an API key (${detail}) — paste one instead.`,
} as const;

export const API_KEY = {
  instructionsTitle: "Phoenix API key",
  instructions: [
    "Create or copy an API key in Phoenix under Settings, then paste it here.",
    "The key is masked while you type and is only written to local credential files.",
  ].join("\n"),
  pasteKeyMessage: "Phoenix API key",
  pasteKeyInvalid: "API key can't be empty.",
  pasteKeyRejected: "That API key was rejected by the instance. Try again.",
} as const;

// ---------------------------------------------------------------------------
// Env file
// ---------------------------------------------------------------------------

export const ENV_FILE = {
  wrote: (names: string[]) =>
    `Wrote ${names.join(" and ")} into this directory (readable only by you).`,
  gitignored: (names: string[]) => `Added ${names.join(", ")} to .gitignore.`,
  fileHeaderEnv: (isoDate: string) =>
    [
      `# Generated by \`px setup\` on ${isoDate}.`,
      "# Contains a Phoenix API key — do NOT commit this file.",
      "# Safe to delete once tracing is verified and production is configured.",
    ].join("\n"),
} as const;

// ---------------------------------------------------------------------------
// Instrumentation
// ---------------------------------------------------------------------------

export const INSTRUMENTATION = {
  modeMessage: "How do you want to instrument this app?",
  launchLabel: (agentLabel: string) => `Hand off to ${agentLabel}`,
  launchHint: "launches here with the setup prompt pre-loaded",
  unknownAgent: (agent: string) => `Unknown agent "${agent}".`,
  agentNotFound: (agentLabel: string, binary: string) =>
    `${agentLabel} isn't on your PATH (looked for \`${binary}\`). Install it, or pick another agent with --agent.`,
  launchingBackground: (agentLabel: string) =>
    `Running ${agentLabel} in the background — it will add tracing and emit a test trace.`,
  backgroundNeedsYolo: (agentLabel: string) =>
    `${agentLabel} runs without a terminal here, so it cannot ask you to approve its edits. Pass --yolo to let it proceed, or it will likely stall until verification times out.`,
  launching: (agentLabel: string) =>
    [
      `Handing off to ${agentLabel} — it will add tracing and emit a test trace.`,
      "When you exit the agent, setup resumes and verifies traces arrived.",
    ].join("\n"),
  agentExitWarning: (agentLabel: string) =>
    `${agentLabel} exited with an error — continuing to verification anyway.`,
  clipboardLabel: "Copy a prompt for my own coding agent",
  clipboardHint:
    "paste it into Claude Code, Codex, Cursor — any agent you run yourself",
  manualLabel: "I'll do it manually",
  manualHint: "follow the quickstart docs yourself",
  promptCopied:
    "Instrumentation prompt copied to your clipboard. Paste it into your agent in this directory.",
  promptCopyFailed:
    "Couldn't write to the clipboard — here is the prompt to copy:",
  clipboardDoneMessage: "When your agent has finished:",
  clipboardDoneLabel: "I've run the prompt",
  manualDocs: (url: string) => `Follow the tracing quickstart: ${url}`,
  manualDoneMessage: "When you've added instrumentation:",
  manualDoneLabel: "I've finished instrumenting",
} as const;

// ---------------------------------------------------------------------------
// Verification + production hand-off
// ---------------------------------------------------------------------------

export const VERIFY = {
  title: "Verifying traces",
  waitingBody: (tracesUrl: string) =>
    [
      "Watching Phoenix for your first trace…",
      "",
      "If nothing has sent a trace yet, in another terminal:",
      "  1. Export the vars:  set -a; source .env.phoenix; set +a",
      "  2. Run your app and make one LLM call.",
      "",
      `Traces appear at ${tracesUrl}`,
    ].join("\n"),
  received: (tracesUrl: string) =>
    `✓ Traces are flowing. View them: ${tracesUrl}`,
  timeoutMessage: "No traces have arrived yet. Keep watching?",
  keepWatchingLabel: "Keep watching",
  finishLabel: "Finish setup — I'll verify later",
  finishHint: "everything else is already configured",
  notVerifiedHeadless: (tracesUrl: string) =>
    `No trace arrived within the wait window. The connection and hand-off files are in place; check ${tracesUrl} once your app sends one.`,
  notVerifiedTitle: "Traces not verified yet",
  notVerifiedBody: (tracesUrl: string) =>
    [
      `Your first trace will appear at ${tracesUrl}`,
      `Not seeing traces? ${DOCS.troubleshooting}`,
    ].join("\n"),
} as const;

export const PRODUCTION = {
  title: "Production hand-off",
  bodyAuthOn: [
    "Set these in your production environment:",
    "",
    "  PHOENIX_COLLECTOR_ENDPOINT — same value as in .env.phoenix",
    "  PHOENIX_API_KEY            — copy from .env.phoenix into your secret store",
    "",
    "The project name is set in code, so no extra env var is needed for it.",
  ].join("\n"),
  bodyAuthOff: [
    "This instance has no auth, so your app only needs:",
    "",
    "  PHOENIX_COLLECTOR_ENDPOINT — your Phoenix URL",
    "",
    "When you deploy Phoenix for real (with auth), also set PHOENIX_API_KEY.",
  ].join("\n"),
} as const;

// ---------------------------------------------------------------------------
// Offer px profile
// ---------------------------------------------------------------------------

export const PX_PROFILE = {
  optInMessage:
    "Also point the px CLI at this project? (lets you query traces from your terminal)",
  optInYes: "Yes, create a px profile",
  optInNo: "No thanks",
  conflictMessage: (profileName: string, endpoint: string) =>
    `px is currently using profile "${profileName}" → ${endpoint}. Switch to this project?`,
  conflictYes: "Yes, switch px to this project",
  conflictNo: "No, leave px as-is",
  created: (profileName: string) =>
    `px profile "${profileName}" created and activated. Try: px trace list`,
  failed: (detail: string) =>
    `Couldn't write the px profile (${detail}). You can create one later with \`px profile create\`.`,
  // Distinct from `failed`: nothing was written, the settings file could not be
  // *read*, and `px profile create` reads it the same strict way — so pointing
  // there would hand back a remedy that fails identically. Name the file
  // instead; repairing or removing it is the only way forward.
  unreadableSettings: (settingsPath: string, detail: string) =>
    `Couldn't read ${settingsPath} (${detail}), so px was left alone. Fix or delete that file, then run \`px profile create\`.`,
} as const;

// ---------------------------------------------------------------------------
// Install tooling (CLI + skills)
// ---------------------------------------------------------------------------

/**
 * The skills repo, named once: the command we spawn and the commands the copy
 * below tells the user to run by hand have to point at the same place.
 */
export const SKILLS_SOURCE = "Arize-ai/phoenix";

/** One copy group per install offer; both share the shape `ToolingOfferCopy`. */
export const TOOLING = {
  cli: {
    message:
      "Install the px CLI globally? (`px` isn't on your PATH — it lets you query traces from any terminal)",
    yes: "Yes, npm install -g @arizeai/phoenix-cli",
    no: "No thanks",
    installed: "px CLI installed. Try `px --help` in a new shell.",
    failed:
      "CLI install failed — install later with `npm install -g @arizeai/phoenix-cli`.",
  },
  skills: {
    message:
      "Install agent skills? (opens a skill picker — query traces, debug failures)",
    yes: `Yes, run npx skills add ${SKILLS_SOURCE}`,
    no: "No thanks",
    installed:
      "Phoenix skills installed. Your coding agent can now query and debug traces.",
    failed: `Skills install failed — install later with \`npx skills add ${SKILLS_SOURCE}\`.`,
  },
} as const;

// ---------------------------------------------------------------------------
// Docs MCP offer
// ---------------------------------------------------------------------------

export const DOCS_MCP = {
  message: (agentLabel: string) =>
    `Connect the Phoenix docs MCP server to ${agentLabel}? (it searches the docs on demand — no download needed)`,
  yes: `Yes, connect ${DOCS_MCP_SERVER_NAME} (recommended)`,
  yesHint: "fastest setup; pulls only the doc sections the agent needs",
  no: "No, download the docs instead",
  noHint: "writes ~100 pages to .px/docs for offline reading",
  /** The decline pair when `--no-docs` means declining downloads nothing. */
  noWithoutDownload: "No, skip it",
  noWithoutDownloadHint:
    "the docs download is off (--no-docs); the agent reads the docs from the web",
  configured: (files: string[]) =>
    `Added the ${DOCS_MCP_SERVER_NAME} MCP server to ${files.join(", ")} — skipping the docs download.`,
  configuredCli: (agentLabel: string) =>
    `Connected the ${DOCS_MCP_SERVER_NAME} MCP server to ${agentLabel} — skipping the docs download.`,
  failedFor: (agentLabel: string, reason: string) =>
    `Couldn't register the ${agentLabel} MCP config (${reason}).`,
  verifyFailed:
    "the entry did not show up in the agent's own MCP listing after adding it",
  fallback: "The MCP server was not connected — downloading the docs instead.",
  fallbackWithoutDownload:
    "The MCP server was not connected — the agent will read the docs from the web.",
  /** Printed when an explicit --docs-mcp met a lane with no agent to configure. */
  noAgentLane: `The clipboard and manual lanes have no coding agent to connect the ${DOCS_MCP_SERVER_NAME} MCP server to — skipping the offer.`,
  unsupported: (agentLabel: string) =>
    `${agentLabel} has no per-project MCP config — skipping the offer.`,
} as const;

// ---------------------------------------------------------------------------
// Docs prefetch
// ---------------------------------------------------------------------------

export const DOCS_PREFETCH = {
  fetching: "Downloading the Phoenix docs so the agent reads them locally...",
  // The unknown-workflow warning is not here: it is worded once in
  // `commands/docs`, next to the list of workflows it has to stay true to, and
  // reaches this step through the docs seam.
  wrote: (pages: number, outputDir: string) =>
    `Downloaded ${pages} doc page(s) to ${outputDir}.`,
  failed: (reason: string) =>
    `Couldn't download the docs (${reason}) — the agent will read them from the web instead.`,
} as const;

// ---------------------------------------------------------------------------
// Headless output
// ---------------------------------------------------------------------------

export const HEADLESS = {
  agentRequired: (agentIds: readonly string[]) =>
    [
      "Missing required flag --agent.",
      "  Headless setup has no prompt to pick an instrumentation lane from, so it must be told which agent to run.",
      `  px setup --no-input --instrument --agent <${agentIds.join("|")}> --yolo`,
      "  To register only — endpoint, project, .env.phoenix, no source changes:",
      "  px setup --no-input",
    ].join("\n"),
  nextSteps: (tracesUrl: string) =>
    [
      "Next steps:",
      "  1. Export the vars:   set -a; source .env.phoenix; set +a",
      `  2. Instrument your app: ${DOCS.instrumentationIndex}`,
      `  3. Watch for traces:  ${tracesUrl}`,
    ].join("\n"),
} as const;
