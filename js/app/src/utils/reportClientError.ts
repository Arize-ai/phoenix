import type { components } from "@phoenix/api/__generated__/v1";
import {
  authFetch,
  isRedirectingToLogin,
  isRedirectingToLoginError,
} from "@phoenix/authFetch";
import { BASE_URL, VERSION } from "@phoenix/config";

export type ClientErrorReport = components["schemas"]["ClientError"];

const MESSAGE_MAX_LENGTH = 2_000;
const STACK_MAX_LENGTH = 16_000;
const URL_MAX_LENGTH = 2_000;
const USER_AGENT_MAX_LENGTH = 512;
const DEFAULT_MAX_DISTINCT_ERRORS = 50;

type SendClientErrorReport = (report: ClientErrorReport) => Promise<unknown>;

function postClientErrorReport(report: ClientErrorReport) {
  return authFetch(`${BASE_URL}/v1/client_errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
    keepalive: true,
  });
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function describeThrownValue(error: unknown): {
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  if (error == null) {
    return { message: "" };
  }
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

/**
 * Build the payload for the client error endpoint from a thrown value.
 * @param params.error - whatever was thrown or rejected with
 * @param params.componentStack - React component stack from an error boundary
 * @param params.url - the SPA route being displayed; defaults to the current location
 * @param params.userAgent - defaults to the browser's user agent
 * @param params.platformVersion - defaults to the version the app was served with
 */
export function buildClientErrorReport({
  error,
  componentStack,
  url = window.location.pathname + window.location.search,
  userAgent = navigator.userAgent,
  platformVersion = VERSION,
}: {
  error: unknown;
  componentStack?: string | null;
  url?: string;
  userAgent?: string;
  platformVersion?: string;
}): ClientErrorReport {
  const { message, stack } = describeThrownValue(error);
  return {
    message: truncate(message || "Unknown error", MESSAGE_MAX_LENGTH),
    stack: stack ? truncate(stack, STACK_MAX_LENGTH) : null,
    component_stack: componentStack
      ? truncate(componentStack, STACK_MAX_LENGTH)
      : null,
    url: truncate(url, URL_MAX_LENGTH),
    user_agent: truncate(userAgent, USER_AGENT_MAX_LENGTH),
    platform_version: platformVersion,
  };
}

/**
 * Create a reporter that sends each distinct error once per page session and
 * never throws, so it is safe to call from error handlers.
 * @param params.send - delivers a report; defaults to POSTing to the server
 * @param params.maxDistinctErrors - after this many distinct errors, further reports are dropped
 */
export function createClientErrorReporter({
  send = postClientErrorReport,
  maxDistinctErrors = DEFAULT_MAX_DISTINCT_ERRORS,
}: {
  send?: SendClientErrorReport;
  maxDistinctErrors?: number;
} = {}) {
  const reportedErrorKeys = new Set<string>();

  return function reportClientError({
    error,
    componentStack,
  }: {
    error: unknown;
    componentStack?: string | null;
  }): void {
    try {
      if (isRedirectingToLoginError(error) || isRedirectingToLogin()) {
        return;
      }
      const report = buildClientErrorReport({ error, componentStack });
      const errorKey = `${report.message}\n${report.stack ?? ""}`;
      const isAlreadyReported = reportedErrorKeys.has(errorKey);
      const isAtCapacity = reportedErrorKeys.size >= maxDistinctErrors;
      if (isAlreadyReported || isAtCapacity) {
        return;
      }
      reportedErrorKeys.add(errorKey);
      send(report).catch(() => {});
    } catch {
      // Reporting must never surface a second error on top of the first.
    }
  };
}

export const reportClientError = createClientErrorReporter();

let hasRegisteredGlobalListeners = false;

/**
 * Report errors that escape React entirely: uncaught exceptions and
 * unhandled promise rejections. Safe to call more than once.
 */
export function registerGlobalClientErrorReporting(): void {
  if (hasRegisteredGlobalListeners) {
    return;
  }
  hasRegisteredGlobalListeners = true;
  window.addEventListener("error", (event) => {
    reportClientError({ error: event.error ?? event.message });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError({ error: event.reason });
  });
}
