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
      const response = await refreshTokens();
      // If there is no response, the token was successfully refreshed
      if (!response) {
        // Retry the original request
        return fetch(input, init);
      }
      // If there is a response, it is a redirect response, and we should return it
      // for any caller to handle / follow as needed
      return response;
    }
    if (error instanceof Error && error.name === "AbortError") {
      // This is triggered when the controller is aborted
      throw error;
    }
  }
  throw new Error("An unexpected error occurred while fetching data");
}

let refreshPromise: Promise<Response | null> | null = null;

export async function refreshTokens(): Promise<Response | null> {
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
      return new Response(null, {
        status: 307,
        headers: { Location: createLoginRedirectUrl() },
      });
    }
    // Clear the refreshPromise so that future requests will trigger a new refresh
    refreshPromise = null;
    return null;
  });
  return refreshPromise;
}
