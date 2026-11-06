import {
  authFetch,
  isRedirectingToLogin,
  isRedirectingToLoginError,
} from "@phoenix/authFetch";
import { BASE_URL, VERSION } from "@phoenix/config";

/**
 * Request body for `POST /client_errors`. Mirrors the server's `ErrorReport` model,
 * which is deliberately kept out of the OpenAPI schema.
 */
export interface ErrorReport {
  message: string;
  stack?: string;
  url?: string;
  user_agent?: string;
  attributes?: Record<string, string>;
}

type SendErrorReport = (report: ErrorReport) => Promise<unknown>;

function postErrorReport(report: ErrorReport) {
  return authFetch(`${BASE_URL}/client_errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
    keepalive: true,
  });
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

const BROWSER_EXTENSION_URL = /^(?:chrome|moz|safari-web)-extension:\/\//;

// A stack line with a `:line:column` location is a frame. Its script URL is
// read from Chrome's `at fn (url:1:2)` / `at url:1:2` form and from Firefox's
// and Safari's `fn@url:1:2` form; other frames, such as eval frames, give none.
const STACK_FRAME_LOCATION = /:\d+:\d+/;
const STACK_FRAME_URL = /(?:\(|@|\bat )([^\s()]+):\d+:\d+\)?\s*$/;

/**
 * Whether an error was thrown by a browser extension's script rather than by
 * Phoenix: every frame of its stack, or, when it has no stack, the script that
 * raised it, comes from an extension.
 */
function isFromBrowserExtension({
  stack,
  filename,
}: {
  stack?: string;
  filename?: string;
}): boolean {
  const frames = (stack ?? "")
    .split("\n")
    .filter((line) => STACK_FRAME_LOCATION.test(line));
  if (frames.length > 0) {
    return frames.every((frame) => {
      const url = frame.match(STACK_FRAME_URL)?.[1];
      return url != null && BROWSER_EXTENSION_URL.test(url);
    });
  }
  return filename != null && BROWSER_EXTENSION_URL.test(filename);
}

/**
 * Build the payload for the error endpoint from a thrown value.
 * @param params.error - whatever was thrown or rejected with
 * @param params.componentStack - React component stack from an error boundary
 * @param params.url - the SPA route being displayed; defaults to the current location
 * @param params.userAgent - defaults to the browser's user agent
 * @param params.platformVersion - defaults to the version the app was served with
 */
export function buildErrorReport({
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
}): ErrorReport {
  const { message, stack } = describeThrownValue(error);
  const attributes: Record<string, string> = {
    platform_version: platformVersion,
  };
  if (componentStack) {
    attributes.component_stack = componentStack;
  }
  return {
    message: message || "Unknown error",
    stack,
    url,
    user_agent: userAgent,
    attributes,
  };
}

/**
 * Create a reporter that sends each distinct error once per page session and
 * never throws, so it is safe to call from error handlers.
 * @param params.send - delivers a report; defaults to POSTing to the server
 */
export function createClientErrorReporter({
  send = postErrorReport,
}: {
  send?: SendErrorReport;
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
      const report = buildErrorReport({ error, componentStack });
      if (isFromBrowserExtension({ stack: report.stack })) {
        return;
      }
      const errorKey = `${report.message}\n${report.stack ?? ""}`;
      if (reportedErrorKeys.has(errorKey)) {
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
    // Browsers dispatch this benign notice, raised when a ResizeObserver
    // callback causes another layout in the same frame, with no `error`.
    if (
      event.error == null &&
      event.message.startsWith("ResizeObserver loop")
    ) {
      return;
    }
    // Extensions that run in the page's main world raise their own uncaught
    // errors on the page's window.
    if (
      isFromBrowserExtension({
        stack: event.error instanceof Error ? event.error.stack : undefined,
        filename: event.filename,
      })
    ) {
      return;
    }
    reportClientError({ error: event.error ?? event.message });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError({ error: event.reason });
  });
}
