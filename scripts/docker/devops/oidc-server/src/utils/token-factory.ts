/**
 * Token generation factory with comprehensive logging
 * DRYs up access token and ID token creation patterns
 */

import { SignJWT } from "jose";
import { createHash } from "crypto";
import type { User, TokenClaims } from "../types/index.js";
import { Logger } from "./logger.js";

export class TokenFactory {
  constructor(
    private keyPair: { privateKey: any; publicKey: any },
    private issuer: string,
    private audienceClientId: string
  ) {}

  /**
   * Calculate at_hash claim
   * Spec: OIDC Core Section 3.1.3.6 - ID Token
   * https://openid.net/specs/openid-connect-core-1_0.html#IDToken
   *
   * Access Token hash value. Its value is the base64url encoding of the left-most
   * half of the hash of the octets of the ASCII representation of the access_token
   * value, where the hash algorithm used is the hash algorithm used in the alg
   * Header Parameter of the ID Token's JOSE Header (SHA-256 for RS256).
   */
  private calculateAtHash(accessToken: string): string {
    const hash = createHash("sha256");
    hash.update(accessToken);
    const fullHash = hash.digest();
    // Take left-most half of the hash
    const halfHash = fullHash.subarray(0, fullHash.length / 2);
    return Buffer.from(halfHash).toString("base64url");
  }

  /**
   * Generate Access Token
   * Spec: OIDC Core Section 3.1.3.8 - Access Token Validation
   * https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse
   *
   * Access tokens are used to access the UserInfo endpoint.
   */
  async generateAccessToken(
    user: User,
    nonce?: string,
    scope?: string
  ): Promise<string> {
    const includeRole = scope?.includes("roles") || false;

    const claims: TokenClaims = {
      sub: user.id, // REQUIRED: Subject identifier
      email: user.email, // Scope: email
      name: user.name, // Scope: profile
      iss: this.issuer, // REQUIRED: Issuer
      aud: this.audienceClientId, // REQUIRED: Audience
      exp: Math.floor(Date.now() / 1000) + 3600, // REQUIRED: Expiration (1 hour)
      iat: Math.floor(Date.now() / 1000), // REQUIRED: Issued at
      ...(nonce && { nonce }), // OPTIONAL: Nonce from auth request
      ...(includeRole && { role: user.role }), // Custom claim
      // Groups are intentionally NOT included in access token
      // They should be fetched from the userinfo endpoint
    };

    Logger.logTokenEvent("access_token_creation", "access", {
      claims,
      key_id: "phoenix-dev-key-1",
      algorithm: "RS256",
    });

    const startTime = Date.now();
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "phoenix-dev-key-1" })
      .sign(this.keyPair.privateKey);

    Logger.logEvent("access_token_created", {
      token_length: token.length,
      user_email: user.email,
    });

    Logger.logEvent("access_token_generated", {
      generation_time_ms: Date.now() - startTime,
      token_length: token.length,
      token_preview: token.substring(0, 50) + "...",
    });

    return token;
  }

  /**
   * Generate ID Token
   * Spec: OIDC Core Section 2 & 3.1.3.6 - ID Token
   * https://openid.net/specs/openid-connect-core-1_0.html#IDToken
   *
   * The primary extension that OpenID Connect makes to OAuth 2.0 to enable
   * End-Users to be Authenticated is the ID Token data structure. The ID Token
   * is a security token that contains Claims about the Authentication of an
   * End-User by an Authorization Server.
   *
   * NOTE: Groups claim should NOT be in ID token - only in userinfo endpoint.
   * This is the recommended approach for Grafana and other OIDC clients.
   */
  async generateIdToken(
    user: User,
    accessToken: string,
    nonce?: string,
    scope?: string
  ): Promise<string> {
    const includeRole = scope?.includes("roles") || false;

    const claims: TokenClaims = {
      sub: user.id, // REQUIRED: Subject identifier
      email: user.email, // Scope: email
      name: user.name, // Scope: profile
      iss: this.issuer, // REQUIRED: Issuer
      aud: this.audienceClientId, // REQUIRED: Audience (client_id)
      exp: Math.floor(Date.now() / 1000) + 3600, // REQUIRED: Expiration (1 hour)
      iat: Math.floor(Date.now() / 1000), // REQUIRED: Issued at
      at_hash: this.calculateAtHash(accessToken), // REQUIRED: Access Token hash (Section 3.1.3.6)
      ...(nonce && { nonce }), // REQUIRED if sent in auth request (replay protection)
      ...(includeRole && { role: user.role }), // Custom claim
      // Groups are intentionally NOT included in ID token
      // They should be fetched from the userinfo endpoint (Section 5.3)
    };

    Logger.logTokenEvent("id_token_creation", "id", {
      claims,
      key_id: "phoenix-dev-key-1",
      algorithm: "RS256",
      audience: this.audienceClientId,
    });

    const startTime = Date.now();
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "phoenix-dev-key-1" })
      .sign(this.keyPair.privateKey);

    Logger.logEvent("id_token_created", {
      token_length: token.length,
      user_email: user.email,
      audience: this.audienceClientId,
    });

    Logger.logEvent("id_token_generated", {
      generation_time_ms: Date.now() - startTime,
      token_length: token.length,
      token_preview: token.substring(0, 50) + "...",
      audience_client_id: this.audienceClientId,
    });

    return token;
  }

  /**
   * Generate both tokens with single call
   * Access token must be generated first to calculate at_hash for ID token
   */
  async generateTokenPair(user: User, nonce?: string, scope?: string) {
    Logger.logEvent("token_generation_started", {
      user_email: user.email,
      nonce: nonce || null,
      scope: scope || "openid",
      groups_requested: scope?.includes("groups") || false,
      roles_requested: scope?.includes("roles") || false,
    });

    // Generate access token first (needed for at_hash in ID token)
    const accessToken = await this.generateAccessToken(user, nonce, scope);

    // Generate ID token with at_hash claim
    const idToken = await this.generateIdToken(user, accessToken, nonce, scope);

    return { accessToken, idToken };
  }
}
