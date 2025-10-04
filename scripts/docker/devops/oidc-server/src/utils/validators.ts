/**
 * OAuth/OIDC validation utilities
 * DRYs up common validation patterns with comprehensive error logging
 */

import { Logger } from "./logger.js";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, any>;
}

export class Validators {
  /**
   * Validate OAuth authorization request parameters
   */
  static validateAuthRequest(params: {
    client_id?: string;
    redirect_uri?: string;
    response_type?: string;
    scope?: string;
    state?: string;
    nonce?: string;
  }): ValidationResult {
    const { client_id, redirect_uri, response_type } = params;

    if (!client_id || !redirect_uri || !response_type) {
      const error = "Invalid request: missing required parameters";
      Logger.logError("oauth_validation_failed", error, {
        missing_params: {
          client_id: !client_id,
          redirect_uri: !redirect_uri,
          response_type: !response_type,
        },
        received_params: {
          client_id: client_id || "MISSING",
          redirect_uri: redirect_uri || "MISSING",
          response_type: response_type || "MISSING",
          scope: params.scope || "not_provided",
          state: params.state ? "provided" : "not_provided",
          nonce: params.nonce ? "provided" : "not_provided",
        },
      });

      return { valid: false, error };
    }

    if (response_type !== "code") {
      const error = "Only authorization code flow supported";
      Logger.logError("oauth_validation_failed", error, {
        expected_response_type: "code",
        received_response_type: response_type,
      });

      return { valid: false, error };
    }

    return { valid: true };
  }

  /**
   * Validate token request parameters
   */
  static validateTokenRequest(body: {
    grant_type?: string;
    code?: string;
    redirect_uri?: string;
    client_secret?: string;
  }): ValidationResult {
    const { grant_type, code, redirect_uri } = body;

    if (grant_type !== "authorization_code") {
      const error = "Only authorization code grant supported";
      Logger.logError("token_validation_failed", error, {
        expected_grant_type: "authorization_code",
        received_grant_type: grant_type,
      });

      return { valid: false, error };
    }

    if (!code) {
      const error = "Authorization code required";
      Logger.logError("token_validation_failed", error, {
        code_provided: false,
      });

      return { valid: false, error };
    }

    return { valid: true };
  }

  /**
   * Validate client credentials (lenient mode for debug server)
   */
  static validateClient(
    validClientIds: string[],
    receivedClientId?: string
  ): ValidationResult {
    Logger.logEvent("token_client_validation", {
      valid_client_ids: validClientIds,
      client_id_valid: validClientIds.includes(receivedClientId || ""),
      validation_mode: "debug_mode_lenient",
      received_client_id: receivedClientId || "not_provided",
    });

    // Debug server is lenient - log but don't fail
    return { valid: true };
  }

  /**
   * Validate redirect URI match
   */
  static validateRedirectUri(
    expected: string,
    received: string
  ): ValidationResult {
    const match = expected === received;

    Logger.logEvent("redirect_uri_validation", {
      expected,
      received,
      match,
    });

    if (!match) {
      const error = "Redirect URI mismatch";
      return {
        valid: false,
        error,
        details: { expected, received },
      };
    }

    return { valid: true };
  }

  /**
   * Generate unique request ID for tracing
   */
  static generateRequestId(prefix: string = "req"): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
