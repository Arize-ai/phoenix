/**
 * Establish the connection.
 *
 * The project itself is never created here — Phoenix creates a project on
 * first ingestion, so setup only needs to settle on a *name* and hand it
 * to the app via `PHOENIX_PROJECT_NAME`. What remains is credential
 * acquisition: the auth-on lanes verify the key with a read-only probe so a
 * bad paste is caught here rather than at first trace. Future OAuth
 * acquisition plugs into the auth-on interactive lane unchanged.
 */

import * as path from "node:path";
import { HttpError } from "@arizeai/phoenix-client";

import * as COPY from "../copy";
import type { SetupDeps } from "../deps";
import { HeadlessInputError, SetupFatalError } from "../errors";
import type { SetupInputs } from "../options";
import { redactForDisplay } from "../util/redact";

export interface Connection {
  /** Normalized origin, no trailing slash. */
  endpoint: string;
  projectName: string;
  /** Present iff auth is enabled on the deployment. */
  apiKey?: string;
}

const REST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Project name
// ---------------------------------------------------------------------------

/** Names are used as URL path identifiers; '/', '?', '#' are invalid. */
export function validateProjectName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /[/?#]/.test(trimmed)) {
    return COPY.CONNECT.projectNameInvalid;
  }
  return undefined;
}

export function defaultProjectName(cwd: string): string {
  const base = path.basename(cwd).replace(/[/?#]/g, "-").trim();
  return base || "default";
}

async function promptForProjectName(
  deps: Pick<SetupDeps, "context" | "prompter">,
  inputs: SetupInputs
): Promise<string> {
  const name =
    inputs.project ??
    (await deps.prompter.textInput({
      message: COPY.CONNECT.projectNameMessage,
      defaultValue: defaultProjectName(deps.context.cwd),
      validate: validateProjectName,
    }));
  return name.trim();
}

// ---------------------------------------------------------------------------
// Credential verification
// ---------------------------------------------------------------------------

type KeyCheck =
  | { kind: "ok" }
  | { kind: "rejected"; status: number }
  | { kind: "error"; detail: string };

/**
 * Read-only probe: list one project. Only the credential matters here — an
 * instance with no projects yet still answers 200.
 */
async function checkApiKey(
  deps: Pick<SetupDeps, "createClient">,
  endpoint: string,
  apiKey: string
): Promise<KeyCheck> {
  const client = deps.createClient({ endpoint, apiKey });
  try {
    await client.GET("/v1/projects", {
      params: { query: { limit: 1 } },
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    return { kind: "ok" };
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403) {
        return { kind: "rejected", status: error.status };
      }
      return { kind: "error", detail: `HTTP ${error.status}` };
    }
    return { kind: "error", detail: redactForDisplay(String(error)) };
  }
}

// ---------------------------------------------------------------------------
// Interactive lanes
// ---------------------------------------------------------------------------

async function connectAuthOff(
  deps: Pick<SetupDeps, "context" | "prompter">,
  endpoint: string,
  inputs: SetupInputs
): Promise<Connection> {
  const projectName = await promptForProjectName(deps, inputs);
  deps.prompter.line(COPY.CONNECT.usingProject(projectName));
  return { endpoint, projectName };
}

/** Prompt for an API key without echoing it to the terminal. */
async function promptForApiKey(
  deps: Pick<SetupDeps, "prompter">
): Promise<string> {
  const apiKey = await deps.prompter.passwordInput({
    message: COPY.API_KEY.pasteKeyMessage,
    validate: (value) =>
      value.trim() ? undefined : COPY.API_KEY.pasteKeyInvalid,
  });
  return apiKey.trim();
}

/**
 * A rejected key returns to the masked credential prompt without asking for
 * the project name again.
 */
async function connectAuthOnInteractive(
  deps: Pick<SetupDeps, "context" | "createClient" | "prompter">,
  endpoint: string,
  inputs: SetupInputs
): Promise<Connection> {
  deps.prompter.note(COPY.API_KEY.instructions, COPY.API_KEY.instructionsTitle);
  let apiKey = await promptForApiKey(deps);
  const projectName = await promptForProjectName(deps, inputs);

  for (;;) {
    const result = await checkApiKey(deps, endpoint, apiKey);
    if (result.kind === "ok") {
      deps.prompter.line(COPY.CONNECT.usingProject(projectName));
      return { endpoint, projectName, apiKey };
    }
    if (result.kind === "rejected") {
      deps.prompter.line(COPY.API_KEY.pasteKeyRejected);
      apiKey = await promptForApiKey(deps);
      continue;
    }
    throw new SetupFatalError(COPY.CONNECT.connectFailed(result.detail));
  }
}

// ---------------------------------------------------------------------------
// Headless lane
// ---------------------------------------------------------------------------

async function connectHeadless(
  deps: Pick<SetupDeps, "createClient">,
  endpoint: string,
  authEnabled: boolean,
  inputs: SetupInputs
): Promise<Connection> {
  if (!inputs.project) {
    throw new HeadlessInputError(COPY.CONNECT.headlessNeedsProject);
  }
  const projectName = inputs.project.trim();

  if (!authEnabled) {
    return { endpoint, projectName };
  }

  const apiKey = inputs.apiKey;
  if (!apiKey) {
    throw new HeadlessInputError(COPY.CONNECT.headlessNeedsApiKey);
  }
  const result = await checkApiKey(deps, endpoint, apiKey);
  if (result.kind === "rejected") {
    throw new SetupFatalError(COPY.CONNECT.headlessAuthRejected);
  }
  if (result.kind === "error") {
    throw new SetupFatalError(COPY.CONNECT.connectFailed(result.detail));
  }
  return { endpoint, projectName, apiKey };
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export interface EstablishConnectionArgs {
  endpoint: string;
  authEnabled: boolean;
  inputs: SetupInputs;
}

export async function establishConnection(
  deps: Pick<SetupDeps, "context" | "createClient" | "prompter">,
  { endpoint, authEnabled, inputs }: EstablishConnectionArgs
): Promise<Connection> {
  // A --project / env-provided name bypasses the prompt in every lane, so
  // enforce here the same rule the prompt validates interactively.
  if (inputs.project !== undefined) {
    const nameError = validateProjectName(inputs.project);
    if (nameError) {
      throw new HeadlessInputError(nameError);
    }
  }
  if (inputs.headless) {
    return connectHeadless(deps, endpoint, authEnabled, inputs);
  }
  if (!authEnabled) {
    return connectAuthOff(deps, endpoint, inputs);
  }
  return connectAuthOnInteractive(deps, endpoint, inputs);
}
