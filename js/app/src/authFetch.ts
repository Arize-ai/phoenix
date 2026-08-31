import { BASE_URL } from "@phoenix/config";

import { createLoginRedirectUrl } from "./utils/routingUtils";

const REFRESH_URL = BASE_URL + "/auth/refresh";
const REFRESH_TIMEOUT_MS = 10_000;

declare global {
  interface Window {
    __PHOENIX_AUTH_REFRESH_TIMEOUT_MS__?: number;
  }
}

function getRefreshTimeoutMs() {
  // primarily exercised by tests, not production code
  return window.__PHOENIX_AUTH_REFRESH_TIMEOUT_MS__ ?? REFRESH_TIMEOUT_MS;
}

class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

class RefreshTimeoutError extends Error {
  constructor() {
    super("Refresh timed out");
  }
}

const REDIRECTING_TO_LOGIN_ERROR_NAME = "RedirectingToLoginError";

/**
 * Thrown after the browser has already been pointed at the login page
 * (`window.location.href = createLoginRedirectUrl()`). Navigation via
 * `window.location.href` is asynchronous — the current document keeps running
 * until the login page's document replaces it — so the pending request still
 * needs to reject to unblock its caller. Error surfaces (the router's
 * errorElement, ErrorBoundary fallbacks) should treat this error as "redirect
 * in progress" and render a neutral pending state rather than an error page.
 */
export class RedirectingToLoginError extends Error {
  constructor(options?: ErrorOptions) {
    super("Redirecting to log in", options);
    this.name = REDIRECTING_TO_LOGIN_ERROR_NAME;
  }
}

/**
 * Detects a {@link RedirectingToLoginError}. Checks the error's name rather
 * than using `instanceof` so the detection is robust to the class being
 * duplicated across bundles.
 */
export function isRedirectingToLoginError(error: unknown): boolean {
  return (
    error instanceof Error && error.name === REDIRECTING_TO_LOGIN_ERROR_NAME
  );
}

/**
 * A wrapper around fetch that retries the request if the server returns a 401.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(input, init).then((response) => {
      if (response.status === 401) {
        // If the server returns a 401, we should try to refresh the token
        throw new UnauthorizedError();
      }
      return response;
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      // If the server returns a 401, we should try to refresh the token
      // If not successful, refreshTokens starts the login redirect and throws
      // RedirectingToLoginError, which propagates out of this function.
      // refreshTokens only resolves with an ok response, but guard
      // defensively: a non-ok response here also means the session is gone.
      const response = await refreshTokens();
      if (!response.ok) {
        window.location.href = createLoginRedirectUrl();
        throw new RedirectingToLoginError();
      }
      return fetch(input, init);
    }
    if (error instanceof Error && error.name === "AbortError") {
      // This is triggered when the controller is aborted
      throw error;
    }
  }
  throw new Error("An unexpected error occurred while fetching data");
}

let refreshPromise: Promise<Response> | null = null;

export async function refreshTokens(): Promise<Response> {
  if (refreshPromise) {
    // There is already a refresh request in progress, so we should wait for it
    return refreshPromise;
  }
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(new RefreshTimeoutError());
  }, getRefreshTimeoutMs());
  // This function should make a request to the server to refresh the access token
  refreshPromise = fetch(REFRESH_URL, {
    method: "POST",
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) {
        throw new UnauthorizedError();
      }
      return response;
    })
    .catch((error: unknown) => {
      // Failed refreshes should fail fast and redirect rather than leave requests hanging.
      if (error instanceof Error && error.name === "AbortError") {
        throw controller.signal.reason ?? error;
      }
      throw error;
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
      refreshPromise = null;
    });

  try {
    return await refreshPromise;
  } catch (error) {
    window.location.href = createLoginRedirectUrl();
    // Navigation is already underway, but this document keeps running until
    // the login page loads. Reject with a dedicated error so error surfaces
    // can show a neutral "redirecting" state instead of flashing an error
    // page during the handoff.
    throw new RedirectingToLoginError({ cause: error });
  }
}
