/**
 * Wait for the first trace to land.
 *
 * Setup verifies data flow itself: it polls the Phoenix span-search API
 * for a span newer than the start of this run until one arrives. The human is
 * only consulted at the timeout escape hatch ("keep watching / finish
 * anyway") — never asked to eyeball the UI as the definition of done.
 */

import { HttpError, type PhoenixClient } from "@arizeai/phoenix-client";

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
 * True when the clock-skew window at `sinceMs` is known to be empty, and so
 * safe for verification to count as part of this run.
 *
 * Checked before instrumentation begins: any span already visible at that
 * point predates this run, so verification must not credit the window. An
 * indeterminate probe answers false for the same reason — widening the window
 * on an answer we could not get would let a span from before this run satisfy
 * verification, which is the false success this whole step exists to prevent.
 */
export async function skewWindowIsClear(
  deps: Pick<SetupDeps, "createClient">,
  connection: Connection,
  { sinceMs }: { sinceMs: number }
): Promise<boolean> {
  const probe = await probeForNewSpans(
    spanSearchClient(deps, connection),
    connection.projectName,
    searchStartTime(sinceMs, START_TIME_SKEW_MS)
  );
  return probe === "none";
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
 * What one span search established. `unknown` is the important one: the
 * request did not come back with an answer, which is not the same as an answer
 * of "no". Polling treats both as "keep watching", but the skew pre-check must
 * not read a failed request as proof the window was empty.
 */
type SpanProbe = "found" | "none" | "unknown";

/** One span-search request. */
async function probeForNewSpans(
  client: PhoenixClient,
  projectName: string,
  startTime: string
): Promise<SpanProbe> {
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
    return (data?.data.length ?? 0) > 0 ? "found" : "none";
  } catch (error) {
    // The client's middleware turns every non-2xx into an HttpError, so a
    // status is only reachable from here. A 404 is a definite "none": the
    // project does not exist, so nothing has ever been delivered to it.
    // Everything else — an auth rejection, a 5xx, a timeout, a dropped
    // socket — is an answer we did not get.
    return error instanceof HttpError && error.status === 404
      ? "none"
      : "unknown";
  }
}

/**
 * Poll until a span arrives or the window elapses, and report how it ended.
 *
 * The terminal probe is returned rather than a bare boolean so the caller can
 * tell "Phoenix says there are no spans" from "Phoenix never answered" — the
 * difference between the user's app not emitting and setup being unable to
 * look, which need different remediation.
 */
async function pollWindow(
  deps: Pick<SetupDeps, "clock">,
  client: PhoenixClient,
  connection: Connection,
  startTime: string
): Promise<SpanProbe> {
  const deadline = deps.clock.now() + POLL_WINDOW_MS;
  for (;;) {
    const probe = await probeForNewSpans(
      client,
      connection.projectName,
      startTime
    );
    if (probe === "found") {
      return probe;
    }
    if (deps.clock.now() >= deadline) {
      return probe;
    }
    await deps.clock.sleep(POLL_INTERVAL_MS);
  }
}

/**
 * How the wait for the first trace ended.
 *
 * `deferred` is the outcome that is not a failure: the user was asked whether
 * to keep watching and chose to stop. Verification was withdrawn, not attempted
 * and lost, so setup must not report it as a broken setup — the escape hatch
 * says "everything else is already configured" and means it.
 */
export type TraceVerification = "verified" | "notVerified" | "deferred";

/**
 * Watch for the first trace since `sinceMs`.
 *
 * The "keep watching?" prompt is the only thing that can extend the wait, so a
 * headless run gets exactly one window: there is no terminal to ask on, and
 * looping forever would hang an unattended caller. That also means only an
 * interactive run can return `deferred` — a headless timeout is nobody's
 * decision.
 *
 * @param args.sinceMs - instrumentation start; only spans after it count.
 * @param args.allowClockSkew - widen the window by the skew tolerance. Pass
 * false unless the window was confirmed empty before instrumentation began
 * (see {@link skewWindowIsClear}), so stale spans cannot satisfy verification.
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
): Promise<TraceVerification> {
  const url = tracesUrl(connection);
  const startTime = searchStartTime(
    sinceMs,
    allowClockSkew ? START_TIME_SKEW_MS : 0
  );
  const client = spanSearchClient(deps, connection);
  deps.prompter.note(COPY.VERIFY.waitingBody(url), COPY.VERIFY.title);
  for (;;) {
    const probe = await pollWindow(deps, client, connection, startTime);
    if (probe === "found") {
      deps.prompter.line(COPY.VERIFY.received(url));
      return "verified";
    }
    // Say which problem this is. "No trace arrived" sends the user to look at
    // their exporter; an unanswered probe means setup could not look at all,
    // and pointing them at instrumentation would be a wild goose chase.
    if (probe === "unknown") {
      deps.prompter.line(COPY.VERIFY.unreachable(connection.endpoint));
    }
    if (headless) {
      deps.prompter.line(COPY.VERIFY.notVerifiedHeadless(url));
      return "notVerified";
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
      return "deferred";
    }
  }
}
