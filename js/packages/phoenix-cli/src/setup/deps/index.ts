/**
 * Dependency seam for setup.
 *
 * Every side effect setup performs — env access, network, subprocesses,
 * clipboard, time — goes through `SetupDeps`. No other module under `setup/`
 * may touch `process.env`, `fetch`, `child_process`, or the clipboard
 * directly. This is what makes setup unit-testable with fakes.
 *
 * Each capability's contract (and, where it is a few lines of system glue,
 * its real implementation) lives in its own module in this directory. This
 * barrel re-exports the contracts so consumers address the seam as one
 * module; it exports types only, so importing it can never form a runtime
 * cycle. The wiring lives in `buildDefaultDeps.ts`.
 */

import type { ClipboardWriter } from "./clipboard";
import type { Clock } from "./clock";
import type { RunContext } from "./context";
import type { DocsFetcher } from "./docs";
import type { OAuthLogin } from "./oauthLogin";
import type { PhoenixClientFactory } from "./phoenixClient";
import type { ProcessRunner } from "./processes";
import type { Prompter } from "./prompter";

export interface SetupDeps {
  /** Ambient facts of the run — data steps read, never call. */
  context: RunContext;
  /** Real: clack-backed ui/clackPrompter.ts; tests: scripted answers. */
  prompter: Prompter;
  processes: ProcessRunner;
  clock: Clock;
  writeClipboard: ClipboardWriter;
  /** Typed Phoenix client; tests inject a fake transport beneath it. */
  createClient: PhoenixClientFactory;
  fetchDocs: DocsFetcher;
  /** Browser OAuth login for minting an API key; tests script outcomes. */
  oauthLogin: OAuthLogin;
}

export type { ClipboardWriter } from "./clipboard";
export type { Clock } from "./clock";
export type { RunContext } from "./context";
export { unknownWorkflowWarning } from "./docs";
export type {
  DocsFetcher,
  DocsPrefetchOptions,
  DocsPrefetchResult,
} from "./docs";
export type {
  OAuthLogin,
  OAuthLoginArgs,
  OAuthLoginOutcome,
} from "./oauthLogin";
export type { PhoenixClientArgs, PhoenixClientFactory } from "./phoenixClient";
export type { CommandSpec, ExecResult, ProcessRunner } from "./processes";
export type { Prompter, SelectOption } from "./prompter";
