import invariant from "tiny-invariant";

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
      // If not successful, the user will be redirected to the login page
      const response = await refreshTokens();
      invariant(
        response.ok,
        `Failed to authenticate. Please visit ${createLoginRedirectUrl()} to login.`
      );
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
    throw error;
  }
}
