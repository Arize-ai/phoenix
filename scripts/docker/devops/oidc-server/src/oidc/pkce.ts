import { createHash, randomBytes } from "crypto";

/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * Spec: RFC 7636 - Proof Key for Code Exchange by OAuth Public Clients
 * https://tools.ietf.org/html/rfc7636
 *
 * PKCE provides additional security for OAuth 2.0 public clients by mitigating
 * authorization code interception attacks.
 */
export class PKCEUtils {
  /**
   * Validate PKCE Challenge Parameters
   * Spec: RFC 7636 Section 4.4 - Client Sends the Code Challenge
   *
   * Validates code_challenge and code_challenge_method during authorization request.
   *
   * Section 4.2 - Client Creates a Code Verifier
   * - Length: 43-128 characters
   * - Characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
   *
   * Section 4.3 - Client Creates the Code Challenge
   * - S256: BASE64URL(SHA256(code_verifier))
   * - plain: code_verifier (not recommended)
   */
  static validatePKCEChallenge(
    codeChallenge?: string,
    codeChallengeMethod?: string
  ): { valid: boolean; error?: string } {
    // RFC 7636 Section 4.4 - code_challenge is REQUIRED
    if (!codeChallenge) {
      return {
        valid: false,
        error: "code_challenge is required for PKCE flow",
      };
    }

    // RFC 7636 Section 4.4 - code_challenge_method is REQUIRED
    if (!codeChallengeMethod) {
      return {
        valid: false,
        error: "code_challenge_method is required for PKCE flow",
      };
    }

    // RFC 7636 Section 4.3 - Only "S256" and "plain" methods are defined
    if (!["S256", "plain"].includes(codeChallengeMethod)) {
      return {
        valid: false,
        error: "code_challenge_method must be 'S256' or 'plain'",
      };
    }

    // RFC 7636 Section 4.2 - Validate code_challenge format
    // Must be 43-128 characters from the unreserved character set
    if (
      codeChallengeMethod === "S256" &&
      !/^[A-Za-z0-9\-._~]{43,128}$/.test(codeChallenge)
    ) {
      return { valid: false, error: "Invalid code_challenge format for S256" };
    }

    if (
      codeChallengeMethod === "plain" &&
      !/^[A-Za-z0-9\-._~]{43,128}$/.test(codeChallenge)
    ) {
      return {
        valid: false,
        error: "Invalid code_challenge format for plain method",
      };
    }

    return { valid: true };
  }

  /**
   * Verify PKCE Code Verifier
   * Spec: RFC 7636 Section 4.6 - Server Verifies code_verifier before Returning the Tokens
   *
   * The server MUST verify the code_verifier by computing the code_challenge
   * from the received code_verifier and comparing it with the previously stored
   * code_challenge.
   *
   * For S256: if BASE64URL(SHA256(code_verifier)) == code_challenge, then valid
   * For plain: if code_verifier == code_challenge, then valid
   */
  static verifyPKCECodeVerifier(
    codeVerifier: string,
    codeChallenge: string,
    codeChallengeMethod: string
  ): boolean {
    if (!codeVerifier || !codeChallenge || !codeChallengeMethod) {
      return false;
    }

    // RFC 7636 Section 4.2 - Validate code_verifier format
    // Must be 43-128 characters from the unreserved character set
    if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) {
      return false;
    }

    // RFC 7636 Section 4.6 - Verification for "plain" method
    if (codeChallengeMethod === "plain") {
      return codeVerifier === codeChallenge;
    }

    // RFC 7636 Section 4.6 - Verification for "S256" method
    // Compute BASE64URL(SHA256(code_verifier)) and compare
    if (codeChallengeMethod === "S256") {
      const hash = createHash("sha256");
      hash.update(codeVerifier);
      const computedChallenge = hash.digest("base64url");
      return computedChallenge === codeChallenge;
    }

    return false;
  }

  /**
   * Generate Code Verifier (for testing)
   * Spec: RFC 7636 Section 4.1 - Client Creates a Code Verifier
   *
   * Creates a cryptographically random string using characters from the
   * unreserved set [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
   * with a minimum length of 43 characters and a maximum length of 128 characters.
   *
   * Note: This is a helper method for testing. Actual clients should implement
   * their own secure code verifier generation.
   */
  static generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Node.js fallback
      const buffer = randomBytes(32);
      for (let i = 0; i < 32; i++) {
        array[i] = buffer[i];
      }
    }
    // base64url encoding produces 43 characters from 32 bytes
    return Buffer.from(array).toString("base64url");
  }

  /**
   * Generate Code Challenge (for testing)
   * Spec: RFC 7636 Section 4.2 - Client Creates the Code Challenge
   *
   * Creates the code_challenge from the code_verifier:
   * - For S256: code_challenge = BASE64URL(SHA256(code_verifier))
   * - For plain: code_challenge = code_verifier
   *
   * Note: This is a helper method for testing. Actual clients should implement
   * their own code challenge generation.
   */
  static generateCodeChallenge(
    codeVerifier: string,
    method: "S256" | "plain" = "S256"
  ): string {
    // RFC 7636 Section 4.2 - plain method
    if (method === "plain") {
      return codeVerifier;
    }

    // RFC 7636 Section 4.2 - S256 method (RECOMMENDED)
    if (method === "S256") {
      const hash = createHash("sha256");
      hash.update(codeVerifier);
      return hash.digest("base64url");
    }

    throw new Error(`Unsupported code challenge method: ${method}`);
  }
}
