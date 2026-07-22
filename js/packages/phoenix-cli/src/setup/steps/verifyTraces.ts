/**
 * Wait for the first trace to land.
 *
 * Setup verifies data flow itself: it polls the Phoenix span-search API
 * for a span newer than the start of this run until one arrives. The human is
 * only consulted at the timeout escape hatch ("keep watching / finish
 * anyway") — never asked to eyeball the UI as the definition of done.
 */

import type { PhoenixClient } from "@arizeai/phoenix-client";

import * as COPY from "../copy";
import type { SetupDeps } from "../deps";
import type { Connection } from "./establishConnection";

const POLL_INTERVAL_MS = 2_000;
const POLL_WINDOW_MS = 60_000;
const POLL_REQUEST_TIMEOUT_MS = 5_000;
/** Tolerance for clock skew between this machine and the span producer. */
const START_TIME_SKEW_MS = 60_000;

/**
 * The project may not exist until the first trace lands, so link by name via
 * the redirect route rather than by an id we no longer have.
 */
export function tracesUrl(connection: Connection): string {
  return `${connection.endpoint}/redirects/projects/${encodeURIComponent(
    connection.projectName
  )}`;
}

/** Inclusive lower bound of the span search, as the API's ISO timestamp. */
function searchStartTime(sinceMs: number, skewMs: number): string {
  return new Date(sinceMs - skewMs).toISOString();
}

/**
 * True when the project already has spans inside the clock-skew window at
 * `sinceMs`. Checked before instrumentation begins: any span visible at that
 * point predates this run, so verification must not credit the skew window.
 */
export async function hasSpansInSkewWindow(
  deps: Pick<SetupDeps, "createClient">,
  connection: Connection,
  { sinceMs }: { sinceMs: number }
): Promise<boolean> {
  return hasNewSpans(
    spanSearchClient(deps, connection),
    connection.projectName,
    searchStartTime(sinceMs, START_TIME_SKEW_MS)
  );
}

function spanSearchClient(
  deps: Pick<SetupDeps, "createClient">,
  connection: Connection
): PhoenixClient {
  return deps.createClient({
    endpoint: connection.endpoint,
    apiKey: connection.apiKey,
  });
}

/**
 * One span-search request. Any failure is a "not yet": a 404 means the project
 * has no spans to have created it, and a network hiccup mid-poll should keep
 * setup watching rather than abort it.
 */
async function hasNewSpans(
  client: PhoenixClient,
  projectName: string,
  startTime: string
): Promise<boolean> {
  try {
    const { data } = await client.GET(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: projectName },
          query: { limit: 1, start_time: startTime },
        },
        signal: AbortSignal.timeout(POLL_REQUEST_TIMEOUT_MS),
      }
    );
    return (data?.data.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Poll until a span arrives or the window elapses. */
async function pollWindow(
  deps: Pick<SetupDeps, "clock">,
  client: PhoenixClient,
  connection: Connection,
  startTime: string
): Promise<boolean> {
  const deadline = deps.clock.now() + POLL_WINDOW_MS;
  for (;;) {
    if (await hasNewSpans(client, connection.projectName, startTime)) {
      return true;
    }
    if (deps.clock.now() >= deadline) {
      return false;
    }
    await deps.clock.sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Watch for the first trace since `sinceMs`. Resolves true when a span is
 * observed via the API, false when the wait ends without one — the user gave
 * up at the timeout prompt, or, in a headless run, the first window elapsed.
 *
 * The "keep watching?" prompt is the only thing that can extend the wait, so a
 * headless run gets exactly one window: there is no terminal to ask on, and
 * looping forever would hang an unattended caller.
 *
 * @param args.sinceMs - instrumentation start; only spans after it count.
 * @param args.allowClockSkew - widen the window by the skew tolerance. Pass
 * false when the project had spans before instrumentation began (see
 * `hasSpansInSkewWindow`), so stale spans cannot satisfy verification.
 * @param args.headless - no prompting; give up after one window.
 */
export async function waitForFirstTrace(
  deps: Pick<SetupDeps, "clock" | "createClient" | "prompter">,
  connection: Connection,
  {
    sinceMs,
    allowClockSkew = true,
    headless = false,
  }: { sinceMs: number; allowClockSkew?: boolean; headless?: boolean }
): Promise<boolean> {
  const url = tracesUrl(connection);
  const startTime = searchStartTime(
    sinceMs,
    allowClockSkew ? START_TIME_SKEW_MS : 0
  );
  const client = spanSearchClient(deps, connection);
  deps.prompter.note(COPY.VERIFY.waitingBody(url), COPY.VERIFY.title);
  for (;;) {
    if (await pollWindow(deps, client, connection, startTime)) {
      deps.prompter.line(COPY.VERIFY.received(url));
      return true;
    }
    if (headless) {
      deps.prompter.line(COPY.VERIFY.notVerifiedHeadless(url));
      return false;
    }
    const keepWatching = await deps.prompter.select<boolean>({
      message: COPY.VERIFY.timeoutMessage,
      options: [
        { value: true, label: COPY.VERIFY.keepWatchingLabel },
        {
          value: false,
          label: COPY.VERIFY.finishLabel,
          hint: COPY.VERIFY.finishHint,
        },
      ],
    });
    if (!keepWatching) {
      deps.prompter.note(
        COPY.VERIFY.notVerifiedBody(url),
        COPY.VERIFY.notVerifiedTitle
      );
      return false;
    }
  }
}
