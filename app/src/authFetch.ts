import { BASE_URL } from "@phoenix/config";

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
  // eslint-disable-next-line no-console
  console.log("authFetch");
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
      await refreshTokens();
      // Retry the original request
      return fetch(input, init);
    }
  }
  throw new Error("An unexpected error occurred while fetching data");
}

async function refreshTokens(url: string = REFRESH_URL): Promise<Response> {
  // This function should make a request to the server to refresh the access token
  // eslint-disable-next-line no-console
  console.log("Refreshing tokens");
  return fetch(url, {
    method: "POST",
  }).then((response) => {
    if (!response.ok) {
      throw new Error("Failed to refresh tokens");
    }
    return response;
  });
}
