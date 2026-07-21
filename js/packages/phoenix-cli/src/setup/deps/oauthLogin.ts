/**
 * The browser-login capability: an ephemeral OAuth2 Authorization Code +
 * PKCE flow, used by setup to obtain a short-lived access token so it can
 * mint an API key on the user's behalf instead of asking them to paste one.
 *
 * Contract plus the real, system-backed implementation (the flow is system
 * glue: an HTTP callback server, a browser launch, and token exchange —
 * exactly the effects the seam exists to keep out of steps). Tests script
 * outcomes through a fake.
 */

import {
  discoverOAuthAuthorizationServer,
  revokeOAuthToken,
  runBrowserLoginFlow,
} from "../../oauth";

export interface OAuthLoginArgs {
  /** Normalized origin, no trailing slash. */
  endpoint: string;
  /**
   * Called with the authorization URL before the browser opens, so the user
   * can complete the login by hand when the launch fails or goes unnoticed.
   */
  onAuthorizationUrl: (url: string) => void;
  /**
   * The browser could not be launched (no `xdg-open`, a headless container).
   * The URL was already narrated, so this is a nudge, not a failure.
   */
  onBrowserOpenFailed: (detail: string) => void;
  /** Abandons an unanswered login, yielding a `cancelled` outcome. */
  signal?: AbortSignal;
}

export type OAuthLoginOutcome =
  | {
      status: "success";
      accessToken: string;
      /**
       * End the grant this login just created, once its token has served its
       * purpose. Scoped to that grant alone — an existing `px auth login`
       * session is a separate grant and survives. Best-effort: the tokens
       * expire on their own regardless.
       */
      revoke: () => Promise<void>;
    }
  /** The user declined the consent screen — a choice, not a failure. */
  | { status: "cancelled" }
  | { status: "error"; detail: string };

export interface OAuthLogin {
  /**
   * Whether the instance runs the OAuth2 authorization server. False on any
   * failure — an unreachable or older server simply keeps the paste lane.
   */
  isSupported(endpoint: string): Promise<boolean>;
  login(args: OAuthLoginArgs): Promise<OAuthLoginOutcome>;
}

/**
 * `apiUrl` is the hidden `--api-url` dev override. It must reach every hop of
 * the flow: the token this mints is spent against the same override by the
 * client factory, so an authorization server at a different host would issue a
 * token the key-minting server rejects. `fetchImpl` is the same transport seam
 * the Phoenix client takes, so the probe is injectable rather than global.
 */
export function createSystemOAuthLogin({
  apiUrl,
  fetchImpl = fetch,
}: {
  apiUrl?: string;
  fetchImpl?: typeof fetch;
} = {}): OAuthLogin {
  // Resolved once: the probe and the flow must agree on which host they talk
  // to, and two `??` expressions are two chances to disagree.
  const apiOrigin = (endpoint: string) => apiUrl ?? endpoint;
  return {
    async isSupported(endpoint) {
      const discovery = await discoverOAuthAuthorizationServer({
        endpoint: apiOrigin(endpoint),
        fetchImpl,
      });
      return discovery.status === "supported";
    },

    async login({ endpoint, onAuthorizationUrl, onBrowserOpenFailed, signal }) {
      const origin = apiOrigin(endpoint);
      try {
        const result = await runBrowserLoginFlow({
          endpoint: origin,
          onAuthorizationUrl,
          onBrowserOpenFailed: (error) =>
            onBrowserOpenFailed(
              error instanceof Error ? error.message : String(error)
            ),
          // No pasted-redirect lane here, unlike `px auth login`. It reads a
          // raw readline off stdin, which would both land unannounced in the
          // middle of the clack wizard and — because readline in terminal mode
          // intercepts Ctrl-C itself — kill the interrupt this login promises
          // as its way out. Setup's fallback is pasting an API key, which the
          // prompter asks for properly.
          allowPastedRedirect: false,
          signal,
        });
        if (result.status === "cancelled") {
          return { status: "cancelled" };
        }
        if (result.status === "invalid") {
          return { status: "error", detail: result.message };
        }
        return {
          status: "success",
          accessToken: result.tokens.access_token,
          revoke: () =>
            revokeOAuthToken({
              endpoint: origin,
              refreshToken: result.tokens.refresh_token,
            }),
        };
      } catch (error) {
        // Every failure — a loopback port that will not bind, a token endpoint
        // that never answers — is an outcome the wizard falls back from, never
        // an exception that ends setup.
        return {
          status: "error",
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
