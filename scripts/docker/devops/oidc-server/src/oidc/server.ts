import {
  SignJWT,
  generateKeyPair,
  exportJWK,
  importPKCS8,
  importSPKI,
  exportPKCS8,
  exportSPKI,
  jwtVerify,
  JWTPayload,
} from "jose";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import type {
  User,
  AuthCodeStore,
  TokenClaims,
  OIDCDiscoveryDocument,
} from "../types/index.js";
import { DatabaseClient } from "../database/client.js";
import { PKCEUtils } from "./pkce.js";
import { Logger } from "../utils/logger.js";
import { TokenFactory } from "../utils/token-factory.js";
import { Validators } from "../utils/validators.js";

export class OIDCServer {
  private keyPair!: { privateKey: any; publicKey: any };
  private jwks!: any;
  private authCodes: AuthCodeStore = {};
  private issuer: string;
  private clientId: string;
  private clientSecret: string;
  private dbClient: DatabaseClient;
  private publicBaseUrl: string;
  private tokenFactory!: TokenFactory;
  private clientAuthMethod: string;

  constructor(
    issuer: string,
    clientId: string,
    clientSecret: string,
    publicBaseUrl?: string,
    clientAuthMethod: string = "all"
  ) {
    this.issuer = issuer;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.publicBaseUrl = publicBaseUrl || issuer;
    this.clientAuthMethod = clientAuthMethod;
    this.dbClient = new DatabaseClient();
  }

  async initialize(): Promise<void> {
    await this.loadOrGenerateKeyPair();
    await this.dbClient.connect();

    const publicJWK = await exportJWK(this.keyPair.publicKey);
    this.jwks = {
      keys: [
        {
          ...publicJWK,
          kid: "phoenix-dev-key-1",
          alg: "RS256",
          use: "sig",
        },
      ],
    };

    // Initialize token factory
    this.tokenFactory = new TokenFactory(
      this.keyPair,
      this.issuer,
      this.clientId
    );

    Logger.logEvent("oidc_server_initialized", {
      key_pair_status: "persistent_rsa_loaded",
      jwks_key_count: this.jwks.keys.length,
      client_auth_methods: this.clientAuthMethod,
      supported_flows: this.getSupportedFlows(),
    });

    const users = this.getUsers();
    Logger.logEvent("user_availability_status", {
      user_count: users.length,
      users:
        users.length > 0
          ? users.map((u: User) => ({ id: u.id, email: u.email, name: u.name }))
          : [],
      status: users.length > 0 ? "users_available" : "awaiting_database",
    });
  }

  private getSupportedFlows(): string[] {
    switch (this.clientAuthMethod) {
      case "oidc":
        return ["standard_oauth"];
      case "pkce-public":
        return ["pkce_public"];
      case "pkce-confidential":
        return ["pkce_confidential"];
      case "all":
        return ["standard_oauth", "pkce_public", "pkce_confidential"];
      default:
        return ["standard_oauth"];
    }
  }

  private isFlowAllowed(
    flowType: "oidc" | "pkce-public" | "pkce-confidential"
  ): boolean {
    switch (this.clientAuthMethod) {
      case "oidc":
        return flowType === "oidc";
      case "pkce-public":
        return flowType === "pkce-public";
      case "pkce-confidential":
        return flowType === "pkce-confidential";
      case "all":
        return true;
      default:
        return flowType === "oidc";
    }
  }

  private async loadOrGenerateKeyPair(): Promise<void> {
    const keyDataPath = "/app/runtime/keypair.json";

    try {
      if (existsSync(keyDataPath)) {
        Logger.logEvent("key_pair_loading_started", {
          source: "persistent_file",
          key_path: keyDataPath,
        });

        const keyData = JSON.parse(readFileSync(keyDataPath, "utf8"));
        const privateKey = await importPKCS8(keyData.privateKey, "RS256");
        const publicKey = await importSPKI(keyData.publicKey, "RS256");

        this.keyPair = { privateKey, publicKey };

        Logger.logEvent("key_pair_loaded_successfully", {
          source: "persistent_file",
          key_type: "RSA",
          algorithm: "RS256",
        });
      } else {
        const keyGenStart = {
          timestamp: new Date().toISOString(),
          event: "key_pair_generation_started",
          algorithm: "RS256",
          reason: "no_existing_key_found",
        };
        console.log(JSON.stringify(keyGenStart));
        this.keyPair = await generateKeyPair("RS256");

        const privateKeyPem = await exportPKCS8(this.keyPair.privateKey);
        const publicKeyPem = await exportSPKI(this.keyPair.publicKey);

        const keyData = {
          privateKey: privateKeyPem,
          publicKey: publicKeyPem,
        };

        writeFileSync(keyDataPath, JSON.stringify(keyData));
        const keyGenComplete = {
          timestamp: new Date().toISOString(),
          event: "key_pair_generated_and_saved",
          key_type: "RSA",
          algorithm: "RS256",
          saved_to: keyDataPath,
          status: "persistent_key_created",
        };
        console.log(JSON.stringify(keyGenComplete));
      }
    } catch (error) {
      const keyError = {
        timestamp: new Date().toISOString(),
        event: "key_pair_operation_failed",
        error: error instanceof Error ? error.message : String(error),
        fallback_action: "generating_in_memory_keys",
      };
      console.log(JSON.stringify(keyError));

      const fallbackStart = {
        timestamp: new Date().toISOString(),
        event: "key_pair_fallback_started",
        method: "in_memory_generation",
        algorithm: "RS256",
      };
      console.log(JSON.stringify(fallbackStart));
      this.keyPair = await generateKeyPair("RS256");
    }
  }

  /**
   * OIDC Discovery Document
   * Spec: OpenID Connect Discovery 1.0 Section 3
   * https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
   *
   * Returns metadata about the OpenID Provider's configuration.
   */
  getDiscoveryDocument(): OIDCDiscoveryDocument {
    const authEndpoint =
      process.env.OIDC_AUTH_ENDPOINT || `${this.issuer}/auth`;

    const discoveryDoc = {
      // REQUIRED: Spec Section 3 - Issuer identifier URL
      issuer: this.issuer,

      // REQUIRED: Spec Section 3 - Authorization endpoint URL
      authorization_endpoint: authEndpoint,

      // REQUIRED: Spec Section 3 - Token endpoint URL
      token_endpoint: `${this.issuer}/token`,

      // RECOMMENDED: Spec Section 5.3 - UserInfo endpoint URL
      userinfo_endpoint: `${this.issuer}/userinfo`,

      // REQUIRED: Spec Section 3 - JWK Set document URL
      jwks_uri: `${this.issuer}/.well-known/jwks.json`,

      // REQUIRED: Spec Section 3 - OAuth 2.0 response types supported
      response_types_supported: ["code"],

      // RECOMMENDED: OAuth 2.0 grant types supported
      grant_types_supported: ["authorization_code"],

      // REQUIRED: Spec Section 8 - Subject identifier types supported
      subject_types_supported: ["public"],

      // REQUIRED: Spec Section 3 - JWS signing algorithms for ID Tokens
      id_token_signing_alg_values_supported: ["RS256"],

      // RECOMMENDED: OAuth 2.0 client authentication methods
      token_endpoint_auth_methods_supported: this.getSupportedAuthMethods(),

      // RECOMMENDED: Spec Section 5.4 - OAuth 2.0 scopes supported
      scopes_supported: ["openid", "email", "profile", "groups", "roles"],

      // RECOMMENDED: Spec Section 5.1 - Claims about the End-User supported
      claims_supported: ["sub", "email", "name", "groups", "role"],

      // OPTIONAL: RFC 7636 (PKCE) - Code challenge methods supported
      code_challenge_methods_supported: this.getSupportedPKCEMethods(),
    };

    Logger.logEvent("discovery_document_generated", {
      client_auth_methods: this.clientAuthMethod,
      supported_flows: this.getSupportedFlows(),
      pkce_methods_supported: discoveryDoc.code_challenge_methods_supported,
      server_restrictions: {
        oidc_only: this.clientAuthMethod === "oidc",
        pkce_public_only: this.clientAuthMethod === "pkce-public",
        pkce_confidential_only: this.clientAuthMethod === "pkce-confidential",
        all_flows: this.clientAuthMethod === "all",
      },
    });

    return discoveryDoc;
  }

  private getSupportedPKCEMethods(): string[] {
    switch (this.clientAuthMethod) {
      case "oidc":
        return []; // No PKCE support for OIDC-only mode
      case "pkce-public":
      case "pkce-confidential":
        return ["S256", "plain"];
      case "all":
        return ["S256", "plain"];
      default:
        return [];
    }
  }

  private getSupportedAuthMethods(): string[] {
    const methods: string[] = [];

    // OAuth 2.0 spec defines these standard methods
    switch (this.clientAuthMethod) {
      case "oidc":
      case "pkce-confidential":
        // Confidential clients support client_secret_basic and client_secret_post
        methods.push("client_secret_basic", "client_secret_post");
        break;
      case "pkce-public":
        // Public clients don't authenticate
        methods.push("none");
        break;
      case "all":
        // Support all methods
        methods.push("client_secret_basic", "client_secret_post", "none");
        break;
    }

    return methods;
  }

  getJWKS() {
    return this.jwks;
  }

  /**
   * Authorization Endpoint - Authorization Code Flow
   * Spec: OIDC Core Section 3.1.2 - Authentication using the Authorization Code Flow
   * https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowAuth
   *
   * Handles authentication requests and returns authorization codes.
   *
   * Section 3.1.2.1 - Authentication Request
   * Section 3.1.2.2 - Authentication Request Validation
   * Section 3.1.2.5 - Successful Authentication Response
   * Section 3.1.2.6 - Authentication Error Response
   */
  async handleAuth(query: any): Promise<{
    redirectUrl: string;
    error?: string;
    error_description?: string;
  }> {
    // Auto-detect flow type (PKCE detection)
    const isPKCE = !!(query.code_challenge && query.code_challenge_method);

    // For authorization requests, we can't determine if it's public or confidential
    // because client secrets are NEVER sent in authorization requests (only in token requests)
    // So we accept the authorization request and validate the client type in the token request
    let flowType: "oidc" | "pkce-public" | "pkce-confidential";
    if (isPKCE) {
      // Accept any PKCE flow in the authorization request
      // The actual validation happens in the token request
      flowType = "pkce-public"; // Use as a placeholder, will be validated in token request
    } else {
      flowType = "oidc";
    }

    const authRequest = {
      timestamp: new Date().toISOString(),
      event: "oauth_auth_request_started",
      query_params: query,
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      response_type: query.response_type,
      scope: query.scope,
      state: query.state,
      nonce: query.nonce,
      detected_flow_type: flowType,
      client_auth_methods_restriction: this.clientAuthMethod,
      flow_allowed: this.isFlowAllowed(flowType),
    };
    console.log(JSON.stringify(authRequest));

    // Check if the detected flow is allowed
    if (!this.isFlowAllowed(flowType)) {
      const flowRejection = {
        timestamp: new Date().toISOString(),
        event: "auth_flow_rejected",
        detected_flow: flowType,
        configured_client_auth_methods: this.clientAuthMethod,
        supported_flows: this.getSupportedFlows(),
        error: `Authentication method '${flowType}' not allowed with current configuration`,
      };
      console.log(JSON.stringify(flowRejection));

      return {
        redirectUrl: `${query.redirect_uri}?error=unsupported_response_type&error_description=${encodeURIComponent(
          `Authentication method '${flowType}' is not supported with current configuration`
        )}&state=${query.state}`,
        error: `Authentication method '${flowType}' not allowed`,
        error_description: `Authentication method '${flowType}' is not supported with current configuration`,
      };
    }

    // Section 3.1.2.1 - Required parameters: response_type, client_id, redirect_uri, scope
    // state is RECOMMENDED for CSRF protection
    const { client_id, redirect_uri, response_type, scope, state, nonce } =
      query;

    // Section 3.1.2.2 - Authentication Request Validation
    // REQUIRED parameters must be present
    if (!client_id || !redirect_uri || !response_type) {
      const errorMsg = "Invalid request: missing required parameters";
      const errorLog = {
        timestamp: new Date().toISOString(),
        event: "oauth_validation_failed",
        error: errorMsg,
        missing_params: {
          client_id: !client_id,
          redirect_uri: !redirect_uri,
          response_type: !response_type,
        },
      };
      console.log(JSON.stringify(errorLog));
      return {
        redirectUrl: "",
        error: errorMsg,
      };
    }

    // Section 3.1.2.1 - response_type MUST be "code" for Authorization Code Flow
    // Section 3.1.2.6 - Error response: unsupported_response_type
    if (response_type !== "code") {
      const errorMsg = "Only authorization code flow supported";
      const errorLog = {
        timestamp: new Date().toISOString(),
        event: "unsupported_response_type",
        error: errorMsg,
        received_response_type: response_type,
        supported_types: ["code"],
      };
      console.log(JSON.stringify(errorLog));
      // Section 3.1.2.6 - Return error via redirect with state parameter
      return {
        redirectUrl: `${redirect_uri}?error=unsupported_response_type&state=${state}`,
        error: errorMsg,
        error_description: errorMsg,
      };
    }

    const users = this.getUsers();
    const userCheck = {
      timestamp: new Date().toISOString(),
      event: "user_availability_check",
      available_users: users.length,
      users: users.map((u) => ({ id: u.id, email: u.email, name: u.name })),
    };
    console.log(JSON.stringify(userCheck));

    if (users.length === 0) {
      const errorMsg = "No users available in database";
      const errorLog = {
        timestamp: new Date().toISOString(),
        event: "no_users_available",
        error: errorMsg,
      };
      console.log(JSON.stringify(errorLog));
      return {
        redirectUrl: `${redirect_uri}?error=access_denied&error_description=No%20users%20available&state=${state}`,
        error: errorMsg,
        error_description: "No users available",
      };
    }

    if (users.length === 1) {
      const user = users[0];
      const authCode = this.generateAuthCode();

      const singleUserLogin = {
        timestamp: new Date().toISOString(),
        event: "single_user_auto_login",
        user: { id: user.id, email: user.email, name: user.name },
        client_id,
        auth_code: authCode.substring(0, 12) + "...",
        redirect_uri,
      };
      console.log(JSON.stringify(singleUserLogin));

      // Section 3.1.2.5 - Store authorization code with required information
      // Authorization codes MUST be short-lived and single-use (Section 4.1.2 of RFC 6749)
      this.authCodes[authCode] = {
        userId: user.id,
        clientId: client_id,
        redirectUri: redirect_uri, // REQUIRED: for validation in token request
        nonce, // OPTIONAL: returned in ID Token if provided (Section 3.1.2.1)
        createdAt: Date.now(),
        scope,
      };

      this.cleanupExpiredCodes();

      // Section 3.1.2.5 - Successful Authentication Response
      // Return authorization code via query parameter with state
      const redirectUrl = `${redirect_uri}?code=${authCode}&state=${state}`;

      const loginComplete = {
        timestamp: new Date().toISOString(),
        event: "single_user_login_completed",
        redirect_url: redirectUrl,
        user_email: user.email,
      };
      console.log(JSON.stringify(loginComplete));

      return { redirectUrl };
    }

    const isPhoenixClient = client_id === "phoenix-oidc-client-id";

    const multiUserDecision = {
      timestamp: new Date().toISOString(),
      event: "multiple_users_behavior_decision",
      client_id,
      is_phoenix_client: isPhoenixClient,
      available_users: users.length,
      behavior: isPhoenixClient
        ? "show_user_selector"
        : "auto_login_first_user",
    };
    console.log(JSON.stringify(multiUserDecision));

    if (isPhoenixClient) {
      const phoenixSelector = {
        timestamp: new Date().toISOString(),
        event: "phoenix_user_selector_initiated",
        available_users: users.length,
        users: users.map((user, i) => ({
          index: i + 1,
          id: user.id,
          name: user.name,
          email: user.email,
        })),
      };
      console.log(JSON.stringify(phoenixSelector));

      const selectionUrl = `${this.publicBaseUrl}/select-user?${new URLSearchParams(
        {
          client_id,
          redirect_uri,
          response_type,
          scope: scope || "",
          state,
          nonce: nonce || "",
        }
      ).toString()}`;

      const selectorRedirect = {
        timestamp: new Date().toISOString(),
        event: "phoenix_selector_redirect",
        selection_url: selectionUrl,
      };
      console.log(JSON.stringify(selectorRedirect));

      return { redirectUrl: selectionUrl };
    } else {
      const sortedUsers = [...users].sort((a, b) => a.id.localeCompare(b.id));
      const user = sortedUsers[0];
      const authCode = this.generateAuthCode();

      const autoLogin = {
        timestamp: new Date().toISOString(),
        event: "multi_user_auto_login",
        client_id,
        total_users: users.length,
        selected_user: { id: user.id, email: user.email, name: user.name },
        selection_method: "first_user_sorted_by_id",
        auth_code: authCode.substring(0, 12) + "...",
      };
      console.log(JSON.stringify(autoLogin));

      this.authCodes[authCode] = {
        userId: user.id,
        clientId: client_id,
        redirectUri: redirect_uri,
        nonce,
        createdAt: Date.now(),
        scope,
      };

      this.cleanupExpiredCodes();

      const redirectUrl = `${redirect_uri}?code=${authCode}&state=${state}`;

      const autoLoginComplete = {
        timestamp: new Date().toISOString(),
        event: "auto_login_completed",
        client_id,
        user_email: user.email,
        redirect_url: redirectUrl,
      };
      console.log(JSON.stringify(autoLoginComplete));

      return { redirectUrl };
    }
  }

  async handleUserSelection(
    selectedUserId: string,
    query: any
  ): Promise<{
    redirectUrl: string;
    error?: string;
    error_description?: string;
  }> {
    const { client_id, redirect_uri, response_type, state, nonce } = query;
    const users = this.getUsers();
    const selectedUser = users.find((user) => user.id === selectedUserId);

    if (!selectedUser) {
      return {
        redirectUrl: `${redirect_uri}?error=access_denied&error_description=Selected%20user%20not%20found&state=${state}`,
        error: "Selected user not found",
      };
    }

    const authCode = this.generateAuthCode();

    this.authCodes[authCode] = {
      userId: selectedUser.id,
      clientId: client_id,
      redirectUri: redirect_uri,
      nonce,
      createdAt: Date.now(),
      scope: query.scope,
    };

    this.cleanupExpiredCodes();

    const redirectUrl = `${redirect_uri}?code=${authCode}&state=${state}`;

    const userSelectionComplete = {
      timestamp: new Date().toISOString(),
      event: "user_selection_completed",
      selected_user: {
        id: selectedUser.id,
        email: selectedUser.email,
        name: selectedUser.name,
      },
      auth_code: authCode.substring(0, 12) + "...",
      redirect_url: redirectUrl,
    };
    console.log(JSON.stringify(userSelectionComplete));

    return { redirectUrl };
  }

  /**
   * Token Endpoint - Authorization Code Flow
   * Spec: OIDC Core Section 3.1.3 - Token Endpoint
   * https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint
   *
   * Exchanges authorization codes for access tokens and ID tokens.
   *
   * Section 3.1.3.1 - Token Request
   * Section 3.1.3.2 - Token Request Validation
   * Section 3.1.3.3 - Successful Token Response
   * Section 3.1.3.4 - Token Error Response
   * Section 9 - Client Authentication
   */
  async handleToken(
    body: any,
    headers: any = {}
  ): Promise<{ tokens?: any; error?: string; error_description?: string }> {
    // Auto-detect flow type
    const isPKCE = !!body.code_verifier;
    const hasClientSecret = !!(
      body.client_secret || headers.authorization?.startsWith("Basic ")
    );

    // Determine the specific flow type for validation
    let flowType: "oidc" | "pkce-public" | "pkce-confidential";
    if (isPKCE) {
      flowType = hasClientSecret ? "pkce-confidential" : "pkce-public";
    } else {
      flowType = "oidc";
    }

    // Check if the detected flow is allowed
    if (!this.isFlowAllowed(flowType)) {
      const flowRejection = {
        timestamp: new Date().toISOString(),
        event: "token_flow_rejected",
        detected_flow: flowType,
        configured_client_auth_methods: this.clientAuthMethod,
        supported_flows: this.getSupportedFlows(),
        error: `Authentication method '${flowType}' not allowed with current configuration`,
      };
      console.log(JSON.stringify(flowRejection));

      return {
        error: "unsupported_grant_type",
        error_description: `Authentication method '${flowType}' is not supported with current configuration`,
      };
    }

    // COMPREHENSIVE DEBUG LOGGING - Security not a concern in debug server
    Logger.logEvent("token_request_debug_start", {
      headers_received: headers,
      body_received: body,
      authorization_header: headers.authorization || "none",
      user_agent: headers["user-agent"] || "none",
      content_type: headers["content-type"] || "none",
      detected_flow_type: flowType,
      client_auth_methods_restriction: this.clientAuthMethod,
      flow_allowed: this.isFlowAllowed(flowType),
    });

    // Section 9 - Client Authentication
    // Supports client_secret_post (body) and client_secret_basic (HTTP Basic Auth)
    // Extract client credentials from either body or Authorization header
    let client_secret = body.client_secret;
    let authSource = "request_body";
    let decodedBasicAuth = null;

    // Section 9 - HTTP Basic Authentication (client_secret_basic)
    // Format: Authorization: Basic BASE64(client_id:client_secret)
    if (headers.authorization?.startsWith("Basic ")) {
      try {
        const base64Part = headers.authorization.slice(6);
        const decoded = Buffer.from(base64Part, "base64").toString();
        const [authClientId, authSecret] = decoded.split(":", 2);

        decodedBasicAuth = {
          original_header: headers.authorization,
          base64_part: base64Part,
          decoded_string: decoded,
          parsed_client_id: authClientId,
          parsed_client_secret: authSecret,
        };

        Logger.logEvent("http_basic_auth_decoded", decodedBasicAuth);

        if (authSecret) {
          client_secret = authSecret;
          authSource = "http_basic_auth";

          Logger.logEvent("client_secret_extracted_from_basic_auth", {
            extracted_secret: authSecret,
            client_id_from_auth: authClientId,
            client_id_from_body: body.client_id,
            client_ids_match: authClientId === body.client_id,
          });
        }
      } catch (error) {
        Logger.logEvent("http_basic_auth_decode_failed", {
          error: error instanceof Error ? error.message : "unknown",
          auth_header_present: !!headers.authorization,
          auth_header_value: headers.authorization,
          stack_trace: error instanceof Error ? error.stack : "none",
        });
      }
    }

    // Final client credential analysis
    Logger.logEvent("client_credential_analysis", {
      client_secret_from_body: body.client_secret || "none",
      client_secret_final: client_secret || "none",
      client_secret_source: authSource,
      client_type_determined: client_secret ? "confidential" : "public",
      has_basic_auth_header: !!headers.authorization?.startsWith("Basic "),
      basic_auth_decode_success: !!decodedBasicAuth,
    });

    // CLIENT SECRET VALIDATION - Critical security check
    const clientId = body.client_id || decodedBasicAuth?.parsed_client_id;
    const expectedSecrets: { [clientId: string]: string } = {
      "phoenix-oidc-client-id": "phoenix-oidc-client-secret-abc-123",
      "grafana-oidc-client-id": "grafana-oidc-client-secret-abc-123",
    };

    const expectedSecret = expectedSecrets[clientId];
    const isValidSecret = client_secret && client_secret === expectedSecret;

    Logger.logEvent("client_secret_validation", {
      client_id: clientId,
      client_secret_provided: client_secret || "none",
      expected_secret_for_client: expectedSecret || "none",
      has_expected_secret: !!expectedSecret,
      secret_validation_result: client_secret
        ? isValidSecret
        : "not_applicable_public_client",
      client_recognized: !!expectedSecret,
      debug_validation_details: {
        provided_secret_length: client_secret?.length || 0,
        expected_secret_length: expectedSecret?.length || 0,
        secrets_match: isValidSecret,
        client_type: client_secret ? "confidential" : "public",
      },
    });

    // For confidential clients, validate the secret
    if (client_secret && !isValidSecret) {
      const validationError = {
        timestamp: new Date().toISOString(),
        event: "client_authentication_failed",
        error: "invalid_client",
        client_id: clientId,
        provided_secret: client_secret,
        expected_secret: expectedSecret,
        reason: !expectedSecret ? "unknown_client" : "invalid_secret",
        debug_hints: [
          "Confidential clients must provide correct client secret",
          "Check client ID and secret configuration",
          expectedSecret
            ? `Expected: ${expectedSecret}`
            : "Client ID not recognized",
        ],
      };
      console.log(JSON.stringify(validationError));
      return { error: "invalid_client" };
    }

    const tokenRequest = {
      timestamp: new Date().toISOString(),
      event: "token_exchange_request_started",
      body_type: typeof body,
      body_keys: Object.keys(body || {}),
      has_client_secret: !!client_secret,
      client_auth_source: authSource,
      client_type: client_secret ? "confidential" : "public",
      full_request_debug: {
        raw_body: body,
        raw_headers: headers,
        decoded_basic_auth: decodedBasicAuth,
        final_client_secret: client_secret,
      },
    };
    console.log(JSON.stringify(tokenRequest));

    // Section 3.1.3.1 - Token Request Parameters
    // REQUIRED: grant_type, code, redirect_uri, client_id (for confidential clients)
    const { grant_type, code, redirect_uri, client_id } = body;

    const extractedParams = {
      timestamp: new Date().toISOString(),
      event: "token_request_params_extracted",
      grant_type,
      code: code ? code.substring(0, 12) + "..." : null,
      redirect_uri,
      client_id,
      client_secret_provided: !!client_secret,
    };
    console.log(JSON.stringify(extractedParams));

    // Section 3.1.3.2 - Token Request Validation
    // grant_type MUST be "authorization_code" for this flow
    if (grant_type !== "authorization_code") {
      const grantTypeError = {
        timestamp: new Date().toISOString(),
        event: "token_grant_type_validation_failed",
        error: "unsupported_grant_type",
        expected: "authorization_code",
        received: grant_type,
      };
      console.log(JSON.stringify(grantTypeError));
      return { error: "unsupported_grant_type" };
    }

    if (!code) {
      const codeError = {
        timestamp: new Date().toISOString(),
        event: "token_missing_auth_code",
        error: "invalid_request",
      };
      console.log(JSON.stringify(codeError));
      return { error: "invalid_request" };
    }

    if (!redirect_uri) {
      const uriError = {
        timestamp: new Date().toISOString(),
        event: "token_missing_redirect_uri",
        error: "invalid_request",
      };
      console.log(JSON.stringify(uriError));
      return { error: "invalid_request" };
    }

    const validClientIds = [this.clientId, "grafana-oidc-client-id"];
    const clientValidation = {
      timestamp: new Date().toISOString(),
      event: "token_client_validation",
      valid_client_ids: validClientIds,
      received_client_id: client_id,
      client_id_valid: validClientIds.includes(client_id),
      validation_mode: "debug_mode_lenient",
    };
    console.log(JSON.stringify(clientValidation));

    const authCodeLookup = {
      timestamp: new Date().toISOString(),
      event: "auth_code_lookup",
      looking_for_code: code.substring(0, 12) + "...",
      available_auth_codes: Object.keys(this.authCodes).length,
      stored_codes: Object.keys(this.authCodes).map((key, i) => ({
        index: i + 1,
        code: key.substring(0, 12) + "...",
        user_id: this.authCodes[key].userId,
        client_id: this.authCodes[key].clientId,
      })),
    };
    console.log(JSON.stringify(authCodeLookup));

    // Section 3.1.3.2 - Validate authorization code
    // Code must exist and not be expired
    const authData = this.authCodes[code];
    if (!authData) {
      const authCodeError = {
        timestamp: new Date().toISOString(),
        event: "auth_code_not_found",
        error: "invalid_grant",
        requested_code: code.substring(0, 12) + "...",
        reason: "auth_code_missing_or_expired",
      };
      console.log(JSON.stringify(authCodeError));
      // Section 3.1.3.4 - Token Error Response
      return { error: "invalid_grant" };
    }

    const authCodeFound = {
      timestamp: new Date().toISOString(),
      event: "auth_code_found",
      user_id: authData.userId,
      client_id: authData.clientId,
      redirect_uri: authData.redirectUri,
      nonce: authData.nonce || null,
      created_at: new Date(authData.createdAt).toISOString(),
      age_ms: Date.now() - authData.createdAt,
    };
    console.log(JSON.stringify(authCodeFound));

    // Section 3.1.3.2 - Validate redirect_uri matches the one from auth request
    // This prevents authorization code injection attacks
    const redirectValidation = {
      timestamp: new Date().toISOString(),
      event: "redirect_uri_validation",
      expected: authData.redirectUri,
      received: redirect_uri,
      match: authData.redirectUri === redirect_uri,
    };
    console.log(JSON.stringify(redirectValidation));

    if (authData.redirectUri !== redirect_uri) {
      const redirectError = {
        timestamp: new Date().toISOString(),
        event: "redirect_uri_mismatch",
        error: "invalid_grant",
      };
      console.log(JSON.stringify(redirectError));
      // Section 16.10 - Security: redirect_uri mismatch is invalid_grant
      return { error: "invalid_grant" };
    }

    const users = this.getUsers();
    const userLookup = {
      timestamp: new Date().toISOString(),
      event: "user_lookup",
      available_users: users.length,
      users: users.map((u, i) => ({
        index: i + 1,
        id: u.id,
        name: u.name,
        email: u.email,
      })),
      looking_for_user_id: authData.userId,
    };
    console.log(JSON.stringify(userLookup));

    const user = users.find((u: User) => u.id === authData.userId) || users[0];
    if (!user) {
      const userNotFound = {
        timestamp: new Date().toISOString(),
        event: "user_not_found",
        error: "user_not_found",
        requested_user_id: authData.userId,
        available_user_ids: users.map((u) => u.id),
      };
      console.log(JSON.stringify(userNotFound));
      return { error: "user_not_found" };
    }

    Logger.logEvent("user_found", {
      user: { id: user.id, name: user.name, email: user.email },
    });

    // Section 3.1.3.3 - Successful Token Response
    // Generate access token and ID token
    // Section 3.1.3.6 - ID Token (required for OpenID Connect)
    // Section 3.1.3.8 - Access Token (for UserInfo endpoint access)
    const { accessToken, idToken } = await this.tokenFactory.generateTokenPair(
      user,
      authData.nonce,
      authData.scope
    );

    // Section 16.9 - Security: Authorization codes MUST be single-use
    const beforeCodeCleanup = Object.keys(this.authCodes).length;
    delete this.authCodes[code];
    const afterCodeCleanup = Object.keys(this.authCodes).length;

    Logger.logEvent("auth_code_cleanup", {
      cleaned_code: code.substring(0, 12) + "...",
      auth_codes_before: beforeCodeCleanup,
      auth_codes_after: afterCodeCleanup,
    });

    // Section 3.1.3.3 - Successful Token Response
    // REQUIRED: access_token, token_type, id_token
    // RECOMMENDED: expires_in, scope
    const tokenResponse = {
      access_token: accessToken,
      id_token: idToken,
      token_type: "Bearer", // REQUIRED: Must be "Bearer" per OAuth 2.0
      expires_in: 3600, // RECOMMENDED: Token lifetime in seconds
      scope: "openid email profile",
    };

    Logger.logEvent("token_exchange_completed", {
      user_email: user.email,
      client_type: client_secret ? "confidential" : "public",
      client_auth_source: authSource,
      tokens_issued: ["access_token", "id_token"],
      token_response: {
        access_token: accessToken.substring(0, 50) + "...",
        id_token: idToken.substring(0, 50) + "...",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid email profile",
      },
    });

    return { tokens: tokenResponse };
  }

  /**
   * UserInfo Endpoint
   * Spec: OIDC Core Section 5.3 - UserInfo Endpoint
   * https://openid.net/specs/openid-connect-core-1_0.html#UserInfo
   *
   * Returns Claims about the authenticated End-User.
   *
   * Section 5.3.1 - UserInfo Request (requires Bearer token)
   * Section 5.3.2 - Successful UserInfo Response
   * Section 5.3.3 - UserInfo Error Response
   */
  async handleUserInfo(
    authHeader?: string
  ): Promise<{ user?: any; error?: string }> {
    Logger.logEvent("userinfo_request_received", {
      has_auth_header: !!authHeader,
      auth_header_format: authHeader?.startsWith("Bearer ")
        ? "bearer_token"
        : "invalid_format",
    });

    // Section 5.3.1 - Authentication REQUIRED using Bearer token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      Logger.logEvent("userinfo_auth_failed", {
        reason: "missing_or_invalid_bearer_token",
        auth_header: authHeader || "none",
      });
      // Section 5.3.3 - UserInfo Error Response
      return { error: "invalid_token" };
    }

    // Extract and verify the access token
    const token = authHeader.slice(7); // Remove "Bearer " prefix
    let tokenClaims: JWTPayload | null = null;
    let userId: string | null = null;

    try {
      const { payload } = await jwtVerify(token, this.keyPair.publicKey);
      tokenClaims = payload;
      userId = payload.sub as string;

      Logger.logEvent("userinfo_token_verified", {
        token_length: token.length,
        token_sub: payload.sub,
        token_aud: payload.aud,
        token_claims: Object.keys(payload),
      });
    } catch (error) {
      Logger.logEvent("userinfo_token_verification_failed", {
        error: error instanceof Error ? error.message : "unknown_error",
        token_length: token.length,
      });
      return { error: "invalid_token" };
    }

    // Find the user from the token's sub claim
    const users = this.getUsers();
    const user = users.find((u: User) => u.id === userId) || users[0];
    if (!user) {
      Logger.logEvent("userinfo_failed", {
        reason: "no_users_available",
        requested_user_id: userId,
      });
      return { error: "no_users_available" };
    }

    // Section 5.3.2 - Successful UserInfo Response
    // Section 5.1 - Standard Claims: sub, email, name
    // Section 5.4 - Claims can be returned from UserInfo endpoint
    // Build userinfo response - ALWAYS include groups and role
    // This is the standard practice for Grafana and other OIDC clients
    // Groups should be retrieved from userinfo endpoint, not from ID token
    const userInfo: any = {
      sub: user.id, // REQUIRED: Subject identifier (Section 5.1)
      email: user.email, // Standard Claim (Section 5.1)
      name: user.name, // Standard Claim (Section 5.1)
      role: user.role, // Custom claim
      groups: user.groups, // Custom claim (best practice: in UserInfo, not ID token)
    };

    Logger.logEvent("userinfo_response_prepared", {
      user_id: user.id,
      user_email: user.email,
      role_included: user.role,
      groups_count: user.groups.length,
      groups_included: user.groups,
      debug_userinfo_claims: userInfo,
      note: "Groups and role are ALWAYS included in userinfo endpoint for Grafana compatibility",
    });

    return { user: userInfo };
  }

  private generateAuthCode(): string {
    return randomBytes(32).toString("base64url");
  }

  /**
   * Cleanup Expired Authorization Codes
   * Spec: Section 4.1.2 of RFC 6749 (OAuth 2.0)
   *
   * Authorization codes MUST be short-lived. This implementation uses
   * a 10-minute expiration as recommended by the spec.
   */
  private cleanupExpiredCodes(): void {
    const now = Date.now();
    // Section 4.1.2 - Authorization codes MUST expire (10 minutes)
    const expiredCodes = Object.keys(this.authCodes).filter(
      (code) => now - this.authCodes[code].createdAt > 10 * 60 * 1000
    );

    expiredCodes.forEach((code) => delete this.authCodes[code]);

    if (expiredCodes.length > 0) {
      const codeCleanup = {
        timestamp: new Date().toISOString(),
        event: "expired_auth_codes_cleaned",
        expired_code_count: expiredCodes.length,
        remaining_code_count: Object.keys(this.authCodes).length,
        expiration_threshold_minutes: 10,
      };
      console.log(JSON.stringify(codeCleanup));
    }
  }

  getUsers(): User[] {
    return this.dbClient.getUsers();
  }

  async cleanup(): Promise<void> {
    await this.dbClient.close();
  }

  /**
   * PKCE Authorization Endpoint
   * Spec: RFC 7636 - Proof Key for Code Exchange
   * https://tools.ietf.org/html/rfc7636
   *
   * Authorization Code Flow with PKCE for public and confidential clients.
   *
   * Section 4.3 - Client Creates the Code Challenge
   * Section 4.4 - Client Sends the Code Challenge with Authorization Request
   */
  async handlePKCEAuth(query: any): Promise<{
    redirectUrl: string;
    error?: string;
    error_description?: string;
  }> {
    const requestId = `pkce-auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // For authorization requests, we can't determine if it's public or confidential
    // because client secrets are NEVER sent in authorization requests (only in token requests)
    // Accept the authorization request and validate the client type in the token request
    const flowType = "pkce-public"; // Placeholder, actual validation happens in token request

    // Check if ANY PKCE flow is allowed (public or confidential)
    const anyPKCEAllowed =
      this.isFlowAllowed("pkce-public") ||
      this.isFlowAllowed("pkce-confidential");
    if (!anyPKCEAllowed) {
      const flowRejection = {
        timestamp: new Date().toISOString(),
        event: "pkce_flow_rejected",
        request_id: requestId,
        configured_client_auth_methods: this.clientAuthMethod,
        supported_flows: this.getSupportedFlows(),
        error: `PKCE authentication method '${flowType}' not allowed with current configuration`,
      };
      console.log(JSON.stringify(flowRejection));

      return {
        redirectUrl: `${query.redirect_uri}?error=unsupported_response_type&error_description=${encodeURIComponent(
          `PKCE authentication method '${flowType}' is not supported with current configuration`
        )}&state=${query.state}`,
        error: `PKCE authentication method '${flowType}' not allowed`,
      };
    }

    const authRequest = {
      timestamp: new Date().toISOString(),
      event: "pkce_auth_request_started",
      request_id: requestId,
      query_params: query,
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      response_type: query.response_type,
      scope: query.scope,
      state: query.state,
      nonce: query.nonce,
      code_challenge: query.code_challenge ? "provided" : "missing",
      code_challenge_method: query.code_challenge_method,
      debug_pkce_analysis: {
        challenge_length: query.code_challenge?.length || 0,
        challenge_method_valid: ["S256", "plain"].includes(
          query.code_challenge_method
        ),
        challenge_format_check: {
          base64url_pattern: query.code_challenge
            ? /^[A-Za-z0-9._~-]+$/.test(query.code_challenge)
            : false,
          expected_s256_length: 43, // Base64URL of SHA256 is 43 chars
          actual_length: query.code_challenge?.length || 0,
        },
        state_provided: !!query.state,
        nonce_provided: !!query.nonce,
        request_from_phoenix_client:
          query.client_id === "phoenix-oidc-client-id",
        request_from_grafana_client:
          query.client_id === "grafana-oidc-client-id",
      },
      debug_request_metadata: {
        query_param_count: Object.keys(query || {}).length,
        required_oauth_params_present: {
          response_type: !!query.response_type,
          client_id: !!query.client_id,
          redirect_uri: !!query.redirect_uri,
          scope: !!query.scope,
        },
        required_pkce_params_present: {
          code_challenge: !!query.code_challenge,
          code_challenge_method: !!query.code_challenge_method,
        },
      },
    };
    console.log(JSON.stringify(authRequest));

    const {
      client_id,
      redirect_uri,
      response_type,
      scope,
      state,
      nonce,
      code_challenge,
      code_challenge_method,
    } = query;

    // Basic OAuth validations (same as regular flow)
    if (!client_id || !redirect_uri || !response_type) {
      const errorMsg = "Invalid request: missing required parameters";
      const errorLog = {
        timestamp: new Date().toISOString(),
        event: "pkce_validation_failed",
        request_id: requestId,
        error: errorMsg,
        missing_params: {
          client_id: !client_id,
          redirect_uri: !redirect_uri,
          response_type: !response_type,
        },
        debug_received_params: {
          client_id: client_id || "MISSING",
          redirect_uri: redirect_uri || "MISSING",
          response_type: response_type || "MISSING",
          scope: scope || "not_provided",
          state: state ? "provided" : "not_provided",
          nonce: nonce ? "provided" : "not_provided",
        },
        phoenix_debug_hints: [
          !client_id ? "Phoenix should set client_id in OAuth2 request" : null,
          !redirect_uri ? "Phoenix should set valid redirect_uri" : null,
          !response_type ? "Phoenix should set response_type=code" : null,
        ].filter(Boolean),
      };
      console.log(JSON.stringify(errorLog));
      return {
        redirectUrl: "",
        error: errorMsg,
      };
    }

    if (response_type !== "code") {
      const errorMsg = "Only authorization code flow supported";
      const errorLog = {
        timestamp: new Date().toISOString(),
        event: "pkce_unsupported_response_type",
        error: errorMsg,
        received_response_type: response_type,
        supported_types: ["code"],
      };
      console.log(JSON.stringify(errorLog));
      return {
        redirectUrl: `${redirect_uri}?error=unsupported_response_type&state=${state}`,
        error: errorMsg,
      };
    }

    // RFC 7636 Section 4.4 - PKCE Challenge Validation
    // code_challenge and code_challenge_method are REQUIRED for PKCE
    const pkceValidation = PKCEUtils.validatePKCEChallenge(
      code_challenge,
      code_challenge_method
    );

    const pkceValidationLog = {
      timestamp: new Date().toISOString(),
      event: "pkce_challenge_validation",
      code_challenge_provided: !!code_challenge,
      code_challenge_method: code_challenge_method,
      validation_result: pkceValidation.valid,
      validation_error: pkceValidation.error || null,
    };
    console.log(JSON.stringify(pkceValidationLog));

    if (!pkceValidation.valid) {
      const errorMsg = pkceValidation.error || "Invalid PKCE parameters";
      return {
        redirectUrl: `${redirect_uri}?error=invalid_request&error_description=${encodeURIComponent(
          errorMsg
        )}&state=${state}`,
        error: errorMsg,
      };
    }

    const users = this.getUsers();
    if (users.length === 0) {
      const errorMsg = "No users available in database";
      const errorLog = {
        timestamp: new Date().toISOString(),
        event: "pkce_no_users_available",
        error: errorMsg,
      };
      console.log(JSON.stringify(errorLog));
      return {
        redirectUrl: `${redirect_uri}?error=access_denied&error_description=No%20users%20available&state=${state}`,
        error: errorMsg,
      };
    }

    // Auto-login logic (same as regular flow)
    if (users.length === 1) {
      const user = users[0];
      const authCode = this.generateAuthCode();

      const singleUserLogin = {
        timestamp: new Date().toISOString(),
        event: "pkce_single_user_auto_login",
        request_id: requestId,
        user: { id: user.id, email: user.email, name: user.name },
        client_id,
        auth_code: authCode.substring(0, 12) + "...",
        redirect_uri,
        pkce_enabled: true,
        debug_auth_completion: {
          auth_code_generated: true,
          challenge_stored: !!code_challenge,
          challenge_method_stored: code_challenge_method,
          nonce_stored: !!nonce,
          auto_login_reason: "single_user_available",
          total_users_found: users.length,
          user_selected: user.id,
          auth_code_length: authCode.length,
          redirect_target: redirect_uri,
          state_will_be_returned: !!state,
        },
        debug_stored_auth_data: {
          user_id: user.id,
          client_id: client_id,
          redirect_uri: redirect_uri,
          nonce_present: !!nonce,
          code_challenge_present: !!code_challenge,
          code_challenge_method: code_challenge_method,
          created_at: new Date().toISOString(),
          expires_in_minutes: 10,
        },
      };
      console.log(JSON.stringify(singleUserLogin));

      this.authCodes[authCode] = {
        userId: user.id,
        clientId: client_id,
        redirectUri: redirect_uri,
        nonce,
        createdAt: Date.now(),
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        scope,
      };

      this.cleanupExpiredCodes();

      const redirectUrl = `${redirect_uri}?code=${authCode}&state=${state}`;
      return { redirectUrl };
    }

    const isPhoenixClient = client_id === "phoenix-oidc-client-id";

    if (isPhoenixClient) {
      const selectionUrl = `${this.publicBaseUrl}/pkce/select-user?${new URLSearchParams(
        {
          client_id,
          redirect_uri,
          response_type,
          scope: scope || "",
          state,
          nonce: nonce || "",
          code_challenge,
          code_challenge_method,
        }
      ).toString()}`;

      const selectorRedirect = {
        timestamp: new Date().toISOString(),
        event: "pkce_selector_redirect",
        selection_url: selectionUrl,
      };
      console.log(JSON.stringify(selectorRedirect));

      return { redirectUrl: selectionUrl };
    } else {
      const sortedUsers = [...users].sort((a, b) => a.id.localeCompare(b.id));
      const user = sortedUsers[0];
      const authCode = this.generateAuthCode();

      const autoLogin = {
        timestamp: new Date().toISOString(),
        event: "pkce_multi_user_auto_login",
        client_id,
        total_users: users.length,
        selected_user: { id: user.id, email: user.email, name: user.name },
        selection_method: "first_user_sorted_by_id",
        auth_code: authCode.substring(0, 12) + "...",
        pkce_enabled: true,
      };
      console.log(JSON.stringify(autoLogin));

      this.authCodes[authCode] = {
        userId: user.id,
        clientId: client_id,
        redirectUri: redirect_uri,
        nonce,
        createdAt: Date.now(),
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        scope,
      };

      this.cleanupExpiredCodes();

      const redirectUrl = `${redirect_uri}?code=${authCode}&state=${state}`;
      return { redirectUrl };
    }
  }

  async handlePKCEUserSelection(
    selectedUserId: string,
    query: any
  ): Promise<{
    redirectUrl: string;
    error?: string;
    error_description?: string;
  }> {
    const {
      client_id,
      redirect_uri,
      response_type,
      state,
      nonce,
      code_challenge,
      code_challenge_method,
    } = query;
    const users = this.getUsers();
    const selectedUser = users.find((user) => user.id === selectedUserId);

    if (!selectedUser) {
      return {
        redirectUrl: `${redirect_uri}?error=access_denied&error_description=Selected%20user%20not%20found&state=${state}`,
        error: "Selected user not found",
      };
    }

    const authCode = this.generateAuthCode();

    this.authCodes[authCode] = {
      userId: selectedUser.id,
      clientId: client_id,
      redirectUri: redirect_uri,
      nonce,
      createdAt: Date.now(),
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      scope: query.scope,
    };

    this.cleanupExpiredCodes();

    const redirectUrl = `${redirect_uri}?code=${authCode}&state=${state}`;

    const userSelectionComplete = {
      timestamp: new Date().toISOString(),
      event: "pkce_user_selection_completed",
      selected_user: {
        id: selectedUser.id,
        email: selectedUser.email,
        name: selectedUser.name,
      },
      auth_code: authCode.substring(0, 12) + "...",
      redirect_url: redirectUrl,
      pkce_enabled: true,
    };
    console.log(JSON.stringify(userSelectionComplete));

    return { redirectUrl };
  }

  /**
   * PKCE Token Endpoint
   * Spec: RFC 7636 - Proof Key for Code Exchange
   * https://tools.ietf.org/html/rfc7636
   *
   * Token exchange with PKCE verification.
   *
   * Section 4.5 - Client Sends the Authorization Code and Code Verifier
   * Section 4.6 - Server Verifies code_verifier against code_challenge
   */
  async handlePKCEToken(
    body: any,
    headers: any = {}
  ): Promise<{ tokens?: any; error?: string; error_description?: string }> {
    const requestId = `pkce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Determine if this is public or confidential PKCE
    const hasClientSecret = !!(
      (body.client_secret && body.client_secret.trim() !== "") ||
      headers.authorization?.startsWith("Basic ")
    );
    const flowType = hasClientSecret ? "pkce-confidential" : "pkce-public";

    // Check if PKCE flow is allowed
    if (!this.isFlowAllowed(flowType)) {
      const flowRejection = {
        timestamp: new Date().toISOString(),
        event: "pkce_token_flow_rejected",
        request_id: requestId,
        configured_client_auth_methods: this.clientAuthMethod,
        supported_flows: this.getSupportedFlows(),
        error: `PKCE authentication method '${flowType}' not allowed with current configuration`,
      };
      console.log(JSON.stringify(flowRejection));

      return {
        error: "unsupported_grant_type",
        error_description: `PKCE authentication method '${flowType}' is not supported with current configuration`,
      };
    }

    // COMPREHENSIVE PKCE DEBUG LOGGING - Security not a concern in debug server
    Logger.logEvent("pkce_token_request_debug_start", {
      request_id: requestId,
      headers_received: headers,
      body_received: body,
      authorization_header: headers.authorization || "none",
      user_agent: headers["user-agent"] || "none",
      content_type: headers["content-type"] || "none",
      code_verifier_present: !!body.code_verifier,
      code_verifier_length: body.code_verifier?.length || 0,
      client_auth_methods_restriction: this.clientAuthMethod,
      flow_allowed: this.isFlowAllowed(flowType),
    });

    // Extract client credentials from either body or Authorization header
    let client_secret = body.client_secret;
    let authSource = "request_body";
    let decodedBasicAuth = null;

    // Check for HTTP Basic Authentication
    if (headers.authorization?.startsWith("Basic ")) {
      try {
        const base64Part = headers.authorization.slice(6);
        const decoded = Buffer.from(base64Part, "base64").toString();
        const [authClientId, authSecret] = decoded.split(":", 2);

        decodedBasicAuth = {
          original_header: headers.authorization,
          base64_part: base64Part,
          decoded_string: decoded,
          parsed_client_id: authClientId,
          parsed_client_secret: authSecret,
        };

        Logger.logEvent("pkce_http_basic_auth_decoded", {
          request_id: requestId,
          ...decodedBasicAuth,
        });

        if (authSecret) {
          client_secret = authSecret;
          authSource = "http_basic_auth";

          Logger.logEvent("pkce_client_secret_extracted_from_basic_auth", {
            request_id: requestId,
            extracted_secret: authSecret,
            client_id_from_auth: authClientId,
            client_id_from_body: body.client_id,
            client_ids_match: authClientId === body.client_id,
          });
        }
      } catch (error) {
        Logger.logEvent("pkce_http_basic_auth_decode_failed", {
          error: error instanceof Error ? error.message : "unknown",
          auth_header_present: !!headers.authorization,
          auth_header_value: headers.authorization,
          stack_trace: error instanceof Error ? error.stack : "none",
          request_id: requestId,
        });
      }
    }

    // Final client credential analysis for PKCE
    Logger.logEvent("pkce_client_credential_analysis", {
      request_id: requestId,
      client_secret_from_body: body.client_secret || "none",
      client_secret_final: client_secret || "none",
      client_secret_source: authSource,
      client_type_determined: client_secret ? "confidential" : "public",
      has_basic_auth_header: !!headers.authorization?.startsWith("Basic "),
      basic_auth_decode_success: !!decodedBasicAuth,
    });

    // PKCE CLIENT SECRET VALIDATION - Critical security check
    const clientId = body.client_id || decodedBasicAuth?.parsed_client_id;
    const expectedSecrets: { [clientId: string]: string } = {
      "phoenix-oidc-client-id": "phoenix-oidc-client-secret-abc-123",
      "grafana-oidc-client-id": "grafana-oidc-client-secret-abc-123",
    };

    const expectedSecret = expectedSecrets[clientId];
    const isValidSecret = client_secret && client_secret === expectedSecret;

    Logger.logEvent("pkce_client_secret_validation", {
      request_id: requestId,
      client_id: clientId,
      client_secret_provided: client_secret || "none",
      expected_secret_for_client: expectedSecret || "none",
      has_expected_secret: !!expectedSecret,
      secret_validation_result: client_secret
        ? isValidSecret
        : "not_applicable_public_client",
      client_recognized: !!expectedSecret,
      debug_validation_details: {
        provided_secret_length: client_secret?.length || 0,
        expected_secret_length: expectedSecret?.length || 0,
        secrets_match: isValidSecret,
        client_type: client_secret ? "confidential" : "public",
      },
    });

    // For confidential clients, validate the secret
    if (client_secret && !isValidSecret) {
      const validationError = {
        timestamp: new Date().toISOString(),
        event: "pkce_client_authentication_failed",
        request_id: requestId,
        error: "invalid_client",
        client_id: clientId,
        provided_secret: client_secret,
        expected_secret: expectedSecret,
        reason: !expectedSecret ? "unknown_client" : "invalid_secret",
        debug_hints: [
          "PKCE confidential clients must provide correct client secret",
          "Check client ID and secret configuration",
          expectedSecret
            ? `Expected: ${expectedSecret}`
            : "Client ID not recognized",
          "This is PKCE + confidential client mode - both PKCE AND secret validation required",
        ],
      };
      console.log(JSON.stringify(validationError));
      return { error: "invalid_client" };
    }

    const tokenRequest = {
      timestamp: new Date().toISOString(),
      event: "pkce_token_exchange_request_started",
      request_id: requestId,
      body_type: typeof body,
      body_keys: Object.keys(body || {}),
      has_code_verifier: !!body.code_verifier,
      code_verifier_length: body.code_verifier?.length || 0,
      request_size_bytes: JSON.stringify(body || {}).length,
      client_auth_source: authSource,
      client_type: client_secret ? "confidential" : "public",
      full_pkce_request_debug: {
        raw_body: body,
        raw_headers: headers,
        decoded_basic_auth: decodedBasicAuth,
        final_client_secret: client_secret,
        complete_code_verifier: body.code_verifier, // Full verifier for debugging
      },
      debug_body_sample: {
        grant_type: body.grant_type,
        client_id: body.client_id,
        has_client_secret: !!client_secret,
        redirect_uri: body.redirect_uri,
        code_prefix: body.code?.substring(0, 8) + "..." || "missing",
        verifier_prefix:
          body.code_verifier?.substring(0, 8) + "..." || "missing",
      },
    };
    console.log(JSON.stringify(tokenRequest));

    const { grant_type, code, redirect_uri, client_id, code_verifier } = body;

    // Basic validations (same as regular flow)
    if (grant_type !== "authorization_code") {
      const grantTypeError = {
        timestamp: new Date().toISOString(),
        event: "pkce_token_grant_type_validation_failed",
        error: "unsupported_grant_type",
        expected: "authorization_code",
        received: grant_type,
      };
      console.log(JSON.stringify(grantTypeError));
      return { error: "unsupported_grant_type" };
    }

    if (!code) {
      const codeError = {
        timestamp: new Date().toISOString(),
        event: "pkce_token_missing_auth_code",
        error: "invalid_request",
      };
      console.log(JSON.stringify(codeError));
      return { error: "invalid_request" };
    }

    if (!redirect_uri) {
      const uriError = {
        timestamp: new Date().toISOString(),
        event: "pkce_token_missing_redirect_uri",
        error: "invalid_request",
      };
      console.log(JSON.stringify(uriError));
      return { error: "invalid_request" };
    }

    // RFC 7636 Section 4.5 - code_verifier is REQUIRED for PKCE
    if (!code_verifier) {
      const verifierError = {
        timestamp: new Date().toISOString(),
        event: "pkce_token_missing_code_verifier",
        error: "invalid_request",
        message: "code_verifier is required for PKCE flow",
      };
      console.log(JSON.stringify(verifierError));
      return { error: "invalid_request" };
    }

    const authData = this.authCodes[code];
    if (!authData) {
      const authCodeError = {
        timestamp: new Date().toISOString(),
        event: "pkce_auth_code_not_found",
        error: "invalid_grant",
        requested_code: code.substring(0, 12) + "...",
      };
      console.log(JSON.stringify(authCodeError));
      return { error: "invalid_grant" };
    }

    // RFC 7636 Section 4.6 - Server Verifies code_verifier
    // For S256: BASE64URL(SHA256(code_verifier)) == code_challenge
    // For plain: code_verifier == code_challenge
    const verificationStartTime = Date.now();
    const pkceVerification = PKCEUtils.verifyPKCECodeVerifier(
      code_verifier,
      authData.codeChallenge || "",
      authData.codeChallengeMethod || ""
    );
    const verificationDurationMs = Date.now() - verificationStartTime;

    const pkceVerificationLog = {
      timestamp: new Date().toISOString(),
      event: "pkce_code_verifier_verification",
      request_id: requestId,
      verification_result: pkceVerification,
      verification_duration_ms: verificationDurationMs,
      code_challenge_method: authData.codeChallengeMethod,
      has_stored_challenge: !!authData.codeChallenge,
      stored_challenge_length: authData.codeChallenge?.length || 0,
      received_verifier_length: code_verifier.length,
      auth_code_age_ms: Date.now() - authData.createdAt,
      debug_verification_data: {
        stored_challenge_prefix:
          authData.codeChallenge?.substring(0, 10) + "..." || "none",
        received_verifier_prefix: code_verifier.substring(0, 10) + "...",
        challenge_method: authData.codeChallengeMethod,
        auth_code_created: new Date(authData.createdAt).toISOString(),
      },
    };
    console.log(JSON.stringify(pkceVerificationLog));

    if (!pkceVerification) {
      const verificationError = {
        timestamp: new Date().toISOString(),
        event: "pkce_code_verifier_verification_failed",
        request_id: requestId,
        error: "invalid_grant",
        message: "code_verifier does not match code_challenge",
        // Comprehensive debug info for troubleshooting Phoenix integration
        debug_failure_analysis: {
          client_id: authData.clientId,
          user_id: authData.userId,
          challenge_method_expected: authData.codeChallengeMethod,
          challenge_method_supported: ["S256", "plain"],
          verifier_length_expected:
            authData.codeChallengeMethod === "S256" ? "43-128 chars" : "any",
          verifier_length_actual: code_verifier.length,
          verifier_format_valid: /^[A-Za-z0-9._~-]{43,128}$/.test(
            code_verifier
          ),
          challenge_stored: !!authData.codeChallenge,
          challenge_length: authData.codeChallenge?.length || 0,
          auth_code_age_seconds: Math.round(
            (Date.now() - authData.createdAt) / 1000
          ),
          timing_suspicious: Date.now() - authData.createdAt < 100, // Less than 100ms
        },
        troubleshooting_hints: [
          code_verifier.length < 43
            ? "Code verifier too short (min 43 chars for PKCE)"
            : null,
          code_verifier.length > 128
            ? "Code verifier too long (max 128 chars)"
            : null,
          !authData.codeChallenge
            ? "No code challenge stored for this auth code"
            : null,
          authData.codeChallengeMethod !== "S256" &&
          authData.codeChallengeMethod !== "plain"
            ? `Unknown challenge method: ${authData.codeChallengeMethod}`
            : null,
          Date.now() - authData.createdAt < 100
            ? "Request too fast - possible replay attack"
            : null,
        ].filter(Boolean),
      };
      console.log(JSON.stringify(verificationError));
      return { error: "invalid_grant" };
    }

    // Rest of token generation (same as regular flow)
    if (authData.redirectUri !== redirect_uri) {
      const redirectError = {
        timestamp: new Date().toISOString(),
        event: "pkce_redirect_uri_mismatch",
        error: "invalid_grant",
      };
      console.log(JSON.stringify(redirectError));
      return { error: "invalid_grant" };
    }

    const users = this.getUsers();
    const user = users.find((u: User) => u.id === authData.userId) || users[0];
    if (!user) {
      const userNotFound = {
        timestamp: new Date().toISOString(),
        event: "pkce_user_not_found",
        error: "user_not_found",
        requested_user_id: authData.userId,
      };
      console.log(JSON.stringify(userNotFound));
      return { error: "user_not_found" };
    }

    // Generate tokens using factory (maintains comprehensive logging)
    const { accessToken, idToken } = await this.tokenFactory.generateTokenPair(
      user,
      authData.nonce,
      authData.scope
    );

    // Clean up auth code
    delete this.authCodes[code];

    const tokenResponse = {
      access_token: accessToken,
      id_token: idToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid email profile",
    };

    const tokenExchangeComplete = {
      timestamp: new Date().toISOString(),
      event: "pkce_token_exchange_completed",
      request_id: requestId,
      user_email: user.email,
      user_id: user.id,
      client_id: authData.clientId,
      tokens_issued: ["access_token", "id_token"],
      pkce_verification: "successful",
      token_response_size_bytes: JSON.stringify(tokenResponse).length,
      debug_token_info: {
        access_token_length: accessToken.length,
        id_token_length: idToken.length,
        expires_in: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        token_type: tokenResponse.token_type,
      },
      debug_flow_metrics: {
        total_request_duration_ms:
          Date.now() - parseInt(requestId.split("-")[1]),
        verification_method_used: authData.codeChallengeMethod,
        auth_code_lifetime_ms: Date.now() - authData.createdAt,
        remaining_auth_codes: Object.keys(this.authCodes).length - 1, // -1 because we'll delete this one
      },
      debug_phoenix_integration: {
        using_pkce_endpoints: true,
        client_type: client_secret ? "confidential" : "public",
        client_auth_source: authSource,
        redirect_uri_validated: true,
        nonce_included: !!authData.nonce,
        audience_client_id: client_id,
      },
    };
    console.log(JSON.stringify(tokenExchangeComplete));

    return { tokens: tokenResponse };
  }
}
