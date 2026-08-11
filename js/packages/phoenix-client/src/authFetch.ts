export interface AuthFetchOptions {
  /**
   * Return an access token for a request.
   *
   * When `forceRefresh` is true, the previous token was rejected with a 401
   * and the provider should refresh it before returning. Providers own token
   * storage and refresh-token rotation.
   */
  getAccessToken: (options: {
    forceRefresh: boolean;
  }) => string | Promise<string>;
  /** Fetch implementation used to send requests. Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Called when the request is still unauthorized after one refresh. */
  onUnauthorized?: (response: Response) => void | Promise<void>;
}

/**
 * Create a fetch implementation that supplies a bearer token and refreshes it
 * after a 401 response.
 *
 * Refresh calls are coalesced so concurrent unauthorized requests rotate a
 * refresh token only once. Each request is retried at most once.
 *
 * @param options - Authentication behavior for the fetch implementation.
 * @param options.getAccessToken - Returns the current token or refreshes it.
 * @param options.fetch - Fetch implementation used to send requests.
 * @param options.onUnauthorized - Handles a second unauthorized response.
 */
export function createAuthFetch({
  getAccessToken,
  fetch: fetchImpl = fetch,
  onUnauthorized,
}: AuthFetchOptions): typeof fetch {
  let refreshPromise: Promise<string> | undefined;

  const refreshAccessToken = (): Promise<string> => {
    if (!refreshPromise) {
      refreshPromise = Promise.resolve(
        getAccessToken({ forceRefresh: true })
      ).finally(() => {
        refreshPromise = undefined;
      });
    }
    return refreshPromise;
  };

  return async function authFetch(
    input: Parameters<typeof fetch>[0],
    init?: RequestInit
  ) {
    const request = new Request(input, init);
    const retryRequest = request.clone();
    const accessToken = await getAccessToken({ forceRefresh: false });
    const response = await fetchImpl(addBearerToken({ request, accessToken }));
    if (response.status !== 401) {
      return response;
    }

    // Another request may already have refreshed and persisted the token while
    // this request was in flight. Reuse it instead of rotating again.
    const currentAccessToken = await getAccessToken({ forceRefresh: false });
    const retryAccessToken =
      currentAccessToken === accessToken
        ? await refreshAccessToken()
        : currentAccessToken;
    const retryResponse = await fetchImpl(
      addBearerToken({ request: retryRequest, accessToken: retryAccessToken })
    );
    if (retryResponse.status === 401) {
      await onUnauthorized?.(retryResponse);
    }
    return retryResponse;
  };
}

function addBearerToken({
  request,
  accessToken,
}: {
  request: Request;
  accessToken: string;
}): Request {
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return new Request(request, { headers });
}
