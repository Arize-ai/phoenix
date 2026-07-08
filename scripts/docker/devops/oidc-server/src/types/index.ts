export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  groups: string[];
}

export interface OIDCConfig {
  issuer: string;
  port: number;
  clientId: string;
  clientSecret: string;
  defaultUsers: User[];
}

import type { JWTPayload } from "jose";

export interface TokenClaims extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  at_hash?: string; // OIDC spec Section 3.1.3.6 - Access Token hash
  role?: string;
  nonce?: string;
  groups?: string[];
}

export interface AuthCodeStore {
  [code: string]: {
    userId: string;
    clientId: string;
    redirectUri: string;
    nonce?: string;
    createdAt: number;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    scope?: string; // Track requested scope
  };
}

export interface OIDCDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  scopes_supported: string[];
  claims_supported: string[];
  code_challenge_methods_supported?: string[];
}
