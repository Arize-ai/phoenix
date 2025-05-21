import invariant from "tiny-invariant";

import { BASE_URL } from "@phoenix/config";

import { createLoginRedirectUrl } from "./utils/routingUtils";

const REFRESH_URL = BASE_URL + "/auth/refresh";

class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
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
  // This function should make a request to the server to refresh the access token
  refreshPromise = fetch(REFRESH_URL, {
    method: "POST",
  }).then((response) => {
    if (!response.ok) {
      // for now force redirect to login page. This could re-throw with a custom error
      // But for now, we'll just redirect
      window.location.href = createLoginRedirectUrl();
      // return a promise that never resolves, giving the browser time to redirect above
      return new Promise(() => {});
    }
    // Clear the refreshPromise so that future requests will trigger a new refresh
    refreshPromise = null;
    return Promise.resolve(response);
  });
  return refreshPromise;
}
