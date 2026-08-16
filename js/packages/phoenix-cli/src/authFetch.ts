import { createAuthFetch } from "@arizeai/phoenix-client";

import type { PhoenixConfig } from "./config";
import { AuthRequiredError } from "./exitCodes";
import { isOAuthTokenExpiring, refreshOAuthTokensForProfile } from "./oauth";
import type { OAuthTokens } from "./settings";

type OAuthConfig = PhoenixConfig & {
  endpoint: string;
  oauthTokens: OAuthTokens;
  profileName: string;
};

export function hasOAuthCredentials(
  config: PhoenixConfig
): config is OAuthConfig {
  return Boolean(config.endpoint && config.oauthTokens && config.profileName);
}

/**
 * Create a fetch implementation backed by the OAuth session in a CLI profile.
 * Refreshed tokens are persisted by the profile token provider.
 *
 * @param options - OAuth fetch configuration.
 * @param options.config - Resolved CLI config containing an OAuth session.
 * @param options.fetch - Fetch implementation used to send requests.
 * @param options.settingsPath - Optional settings path override for tests.
 */
export function createOAuthFetch({
  config,
  fetch: fetchImpl = fetch,
  settingsPath,
}: {
  config: OAuthConfig;
  fetch?: typeof fetch;
  settingsPath?: string;
}): typeof fetch {
  let tokens = config.oauthTokens;
  const authFetch = createAuthFetch({
    fetch: fetchImpl,
    getAccessToken: async ({ forceRefresh }) => {
      if (forceRefresh || isOAuthTokenExpiring({ tokens })) {
        tokens = await refreshOAuthTokensForProfile({
          endpoint: config.endpoint,
          profileName: config.profileName,
          currentTokens: tokens,
          force: forceRefresh,
          fetchImpl,
          settingsPath,
        });
      }
      return tokens.accessToken;
    },
    onUnauthorized: () => {
      throw new AuthRequiredError("Session expired. Run: px auth login");
    },
  });

  return function oauthFetch(input: RequestInfo | URL, init?: RequestInit) {
    const request = new Request(input, init);
    const headers = new Headers(config.headers);
    request.headers.forEach((value, key) => headers.set(key, value));
    return authFetch(new Request(request, { headers }));
  };
}
