/**
 * Choose the endpoint: where Phoenix is, and whether it wants an API key.
 *
 * Two options — Local or Remote ("paste your instance URL"). The probe is
 * an unauthenticated
 * `GET /v1/projects?limit=1`: 200 → auth off, 401/403 → auth on, anything
 * else → troubleshoot copy and re-ask (max 3 attempts).
 */

import { HttpError } from "@arizeai/phoenix-client";

import { isEndpointUrl, normalizeEndpoint } from "../../validation/endpoint";
import * as COPY from "../copy";
import type { SetupDeps } from "../deps";
import {
  HeadlessInputError,
  SetupCancelledError,
  SetupFatalError,
} from "../errors";
import { redactForDisplay } from "../util/redact";

export interface EndpointChoice {
  /** Normalized origin, no trailing slash. */
  endpoint: string;
  authEnabled: boolean;
}

const PROBE_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const DEFAULT_LOCAL_ENDPOINT = "http://localhost:6006";

export type ProbeOutcome =
  | { kind: "authOff" }
  | { kind: "authOn" }
  | { kind: "unreachable"; detail: string }
  | { kind: "notPhoenix"; detail: string };

/**
 * Probe an endpoint to determine reachability and whether auth is enabled.
 */
export async function probeEndpoint(
  deps: Pick<SetupDeps, "createClient">,
  endpoint: string
): Promise<ProbeOutcome> {
  const client = deps.createClient({ endpoint });
  try {
    await client.GET("/v1/projects", {
      params: { query: { limit: 1 } },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return { kind: "authOff" };
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403) {
        return { kind: "authOn" };
      }
      return { kind: "notPhoenix", detail: `HTTP ${error.status}` };
    }
    // A 2xx whose body will not parse: something is listening, but it is not
    // the Phoenix API.
    if (error instanceof SyntaxError) {
      return { kind: "notPhoenix", detail: COPY.ENDPOINT.unexpectedBody };
    }
    return { kind: "unreachable", detail: redactForDisplay(String(error)) };
  }
}

async function promptForEndpoint(
  deps: Pick<SetupDeps, "prompter">
): Promise<string> {
  const choice = await deps.prompter.select<"local" | "remote">({
    message: COPY.ENDPOINT.selectMessage,
    options: [
      {
        value: "local",
        label: COPY.ENDPOINT.localLabel,
        hint: COPY.ENDPOINT.localHint,
      },
      {
        value: "remote",
        label: COPY.ENDPOINT.remoteLabel,
        hint: COPY.ENDPOINT.remoteHint,
      },
    ],
  });
  if (choice === "local") {
    return DEFAULT_LOCAL_ENDPOINT;
  }
  const url = await deps.prompter.textInput({
    message: COPY.ENDPOINT.remoteUrlMessage,
    validate: (value) =>
      isEndpointUrl(value) ? undefined : COPY.ENDPOINT.remoteUrlInvalid,
  });
  return url;
}

export interface ChooseEndpointArgs {
  /** Pre-answered endpoint from --endpoint / env (skips the select). */
  presetEndpoint?: string;
  headless: boolean;
}

export async function chooseEndpoint(
  deps: Pick<SetupDeps, "createClient" | "prompter">,
  { presetEndpoint, headless }: ChooseEndpointArgs
): Promise<EndpointChoice> {
  let attempts = 0;
  let candidate = presetEndpoint;

  for (;;) {
    if (candidate === undefined) {
      if (headless) {
        throw new HeadlessInputError(COPY.ENDPOINT.headlessNeedsEndpoint);
      }
      candidate = await promptForEndpoint(deps);
    }
    let endpoint: string;
    try {
      endpoint = normalizeEndpoint(candidate);
    } catch {
      if (headless) {
        throw new HeadlessInputError(COPY.ENDPOINT.remoteUrlInvalid);
      }
      deps.prompter.line(COPY.ENDPOINT.remoteUrlInvalid);
      candidate = undefined;
      continue;
    }

    deps.prompter.line(COPY.ENDPOINT.probing(endpoint));
    const outcome = await probeEndpoint(deps, endpoint);

    if (outcome.kind === "authOff") {
      deps.prompter.line(COPY.ENDPOINT.authOff);
      return { endpoint, authEnabled: false };
    }
    if (outcome.kind === "authOn") {
      deps.prompter.line(COPY.ENDPOINT.authOn);
      return { endpoint, authEnabled: true };
    }

    if (headless) {
      throw new SetupFatalError(COPY.ENDPOINT.headlessUnreachable(endpoint));
    }

    attempts += 1;
    deps.prompter.line(
      outcome.kind === "unreachable"
        ? COPY.ENDPOINT.unreachable(endpoint)
        : COPY.ENDPOINT.notPhoenix(endpoint, outcome.detail)
    );

    if (attempts >= MAX_ATTEMPTS) {
      deps.prompter.line(COPY.ENDPOINT.gaveUp);
      throw new SetupCancelledError();
    }

    const retry = await deps.prompter.select<boolean>({
      message: COPY.ENDPOINT.retryMessage,
      options: [
        { value: true, label: COPY.ENDPOINT.retryYes },
        { value: false, label: COPY.ENDPOINT.retryNo },
      ],
    });
    if (!retry) {
      throw new SetupCancelledError();
    }
    candidate = undefined;
  }
}
