/**
 * Establish the connection.
 *
 * The project itself is never created here — Phoenix creates a project on
 * first ingestion, so setup only needs to settle on a *name* and hand it
 * to the app via `PHOENIX_PROJECT_NAME`. What remains is credential
 * acquisition: the auth-on lanes verify the key with a read-only probe so a
 * bad paste is caught here rather than at first trace. When the instance runs
 * the OAuth2 authorization server, the interactive lane offers a streamlined
 * path first — log in with the browser, mint an API key over REST, revoke the
 * grant that login created — and every failure along it falls back to the
 * paste prompt rather than aborting setup.
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

/** A REST failure, as a short phrase to show the user. */
function describeRestError(error: unknown): string {
  if (error instanceof HttpError) {
    return `HTTP ${error.status}`;
  }
  // A 2xx whose body will not parse: something answered, but not the Phoenix
  // API. The raw parser message would only confuse.
  if (error instanceof SyntaxError) {
    return COPY.ENDPOINT.unexpectedBody;
  }
  return redactForDisplay(String(error));
}

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
    if (
      error instanceof HttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      return { kind: "rejected", status: error.status };
    }
    return { kind: "error", detail: describeRestError(error) };
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
 * Log in via the browser, then mint a personal API key over REST. Every
 * failure returns `undefined` after narrating why, sending the lane to the
 * paste prompt — the login is a shortcut, never a wall.
 */
async function acquireApiKeyViaLogin(
  deps: Pick<SetupDeps, "createClient" | "prompter" | "oauthLogin">,
  endpoint: string,
  projectName: string
): Promise<string | undefined> {
  // Ctrl-C here means "give up on the browser", not "abandon setup" — the
  // paste prompt below is still a way forward, and the project name the user
  // already gave is still good.
  const outcome = await deps.prompter.runInterruptible((signal) =>
    deps.oauthLogin.login({
      endpoint,
      onAuthorizationUrl: (url) =>
        deps.prompter.note(COPY.CREDENTIALS.authorizationUrl(url)),
      onBrowserOpenFailed: (detail) =>
        deps.prompter.line(
          COPY.CREDENTIALS.browserOpenFailed(redactForDisplay(detail))
        ),
      signal,
    })
  );
  if (outcome.status === "cancelled") {
    deps.prompter.line(COPY.CREDENTIALS.loginCancelled);
    return undefined;
  }
  if (outcome.status === "error") {
    deps.prompter.line(
      COPY.CREDENTIALS.loginFailed(redactForDisplay(outcome.detail))
    );
    return undefined;
  }

  try {
    const client = deps.createClient({
      endpoint,
      apiKey: outcome.accessToken,
    });
    const name = `px-setup ${projectName}`;
    const response = await client.POST("/v1/user/api_keys", {
      body: {
        data: {
          name,
          description: `Created by px setup for project "${projectName}".`,
        },
      },
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    const key = response.data?.data.key;
    if (!key) {
      deps.prompter.line(
        COPY.CREDENTIALS.keyCreateFailed("empty key in response")
      );
      return undefined;
    }
    deps.prompter.line(COPY.CREDENTIALS.keyCreated(name));
    return key;
  } catch (error) {
    deps.prompter.line(
      COPY.CREDENTIALS.keyCreateFailed(describeRestError(error))
    );
    return undefined;
  } finally {
    // The access token has served its one purpose. Ending the grant leaves the
    // key in local files as the only credential this run created — without it,
    // a refresh token setup no longer holds stays live for its full lifetime
    // (a week by default). This does not touch an existing `px auth login`.
    await outcome.revoke().catch(() => {});
  }
}

/**
 * The project name comes first so the browser-login path can stamp it into
 * the minted key's name. A rejected key returns to the masked credential
 * prompt without asking for the project name again.
 */
async function connectAuthOnInteractive(
  deps: Pick<SetupDeps, "context" | "createClient" | "prompter" | "oauthLogin">,
  endpoint: string,
  inputs: SetupInputs
): Promise<Connection> {
  // Start the probe before the prompt so it can run while the user types (when
  // --project is given there is no prompt, and this is simply awaited below).
  // The `catch` is not redundant: the contract returns Promise<boolean>, and an
  // implementation that rejected would otherwise go unhandled on the path where
  // the prompt throws SetupCancelledError before the await below is reached.
  const supportsLogin = deps.oauthLogin
    .isSupported(endpoint)
    .catch(() => false);
  const projectName = await promptForProjectName(deps, inputs);

  if (await supportsLogin) {
    const method = await deps.prompter.select<"login" | "paste">({
      message: COPY.CREDENTIALS.methodMessage,
      options: [
        {
          value: "login",
          label: COPY.CREDENTIALS.loginLabel,
          hint: COPY.CREDENTIALS.loginHint,
        },
        {
          value: "paste",
          label: COPY.CREDENTIALS.pasteLabel,
          hint: COPY.CREDENTIALS.pasteHint,
        },
      ],
    });
    if (method === "login") {
      const apiKey = await acquireApiKeyViaLogin(deps, endpoint, projectName);
      if (apiKey !== undefined) {
        // The key was just minted by an authenticated call to this same
        // endpoint, so a probe could only re-prove what the mint proved. It
        // could, however, fail transiently — and the ephemeral session is
        // already revoked, so a throw here would strand a live key the user
        // never received and cannot name.
        deps.prompter.line(COPY.CONNECT.usingProject(projectName));
        return { endpoint, projectName, apiKey };
      }
    }
  }
  deps.prompter.note(COPY.API_KEY.instructions, COPY.API_KEY.instructionsTitle);
  let apiKey = await promptForApiKey(deps);

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
  deps: Pick<SetupDeps, "context" | "createClient" | "prompter" | "oauthLogin">,
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
