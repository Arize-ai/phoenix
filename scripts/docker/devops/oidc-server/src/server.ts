#!/usr/bin/env node

import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import staticFiles from "@fastify/static";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { OIDCServer } from "./oidc/server.js";
import { PKCEUtils } from "./oidc/pkce.js";
import { Logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.OIDC_PORT || "9000");
const ISSUER = process.env.OIDC_ISSUER || `http://localhost:${PORT}`;
const CLIENT_ID = process.env.OIDC_CLIENT_ID || "phoenix-oidc-client-id";
const CLIENT_SECRET =
  process.env.OIDC_CLIENT_SECRET || "phoenix-oidc-client-secret-abc-123";

const PUBLIC_BASE_URL = process.env.OIDC_PUBLIC_BASE_URL || ISSUER;

// OIDC client authentication method configuration
const OIDC_CLIENT_AUTH_METHOD = process.env.OIDC_CLIENT_AUTH_METHOD || "oidc";
const VALID_CLIENT_AUTH_METHODS = [
  "oidc",
  "pkce-public",
  "pkce-confidential",
  "all",
];

const fastifyOptions: any = {
  logger: true,
};

// Validate client authentication method
if (!VALID_CLIENT_AUTH_METHODS.includes(OIDC_CLIENT_AUTH_METHOD)) {
  console.error(
    `Invalid OIDC_CLIENT_AUTH_METHOD: ${OIDC_CLIENT_AUTH_METHOD}. Valid methods: ${VALID_CLIENT_AUTH_METHODS.join(", ")}`
  );
  process.exit(1);
}

const clientAuthMethodConfig = {
  timestamp: new Date().toISOString(),
  event: "oidc_client_auth_method_configured",
  client_auth_method: OIDC_CLIENT_AUTH_METHOD,
  valid_methods: VALID_CLIENT_AUTH_METHODS,
  server_behavior: {
    oidc_only: OIDC_CLIENT_AUTH_METHOD === "oidc",
    pkce_public_only: OIDC_CLIENT_AUTH_METHOD === "pkce-public",
    pkce_confidential_only: OIDC_CLIENT_AUTH_METHOD === "pkce-confidential",
    all_methods_enabled: OIDC_CLIENT_AUTH_METHOD === "all",
  },
};
console.log(JSON.stringify(clientAuthMethodConfig));

const fastify = Fastify(fastifyOptions);
const oidcServer = new OIDCServer(
  ISSUER,
  CLIENT_ID,
  CLIENT_SECRET,
  PUBLIC_BASE_URL,
  OIDC_CLIENT_AUTH_METHOD
);

async function setupPlugins() {
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(formbody);
  const staticPath = join(__dirname, "../dist-frontend");
  const staticSetup = {
    timestamp: new Date().toISOString(),
    event: "static_files_setup_started",
    static_path: staticPath,
    prefix: "/",
  };
  console.log(JSON.stringify(staticSetup));

  try {
    await fastify.register(staticFiles, {
      root: staticPath,
      prefix: "/",
      decorateReply: false,
      setHeaders: (res, pathname) => {
        if (pathname.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      },
    });
    const staticSuccess = {
      timestamp: new Date().toISOString(),
      event: "static_files_registered_successfully",
      static_path: staticPath,
    };
    console.log(JSON.stringify(staticSuccess));
  } catch (error) {
    const staticError = {
      timestamp: new Date().toISOString(),
      event: "static_files_registration_failed",
      error: error instanceof Error ? error.message : String(error),
      static_path: staticPath,
    };
    console.log(JSON.stringify(staticError));
  }
}

async function setupRoutes() {
  fastify.get("/", async (request, reply) => {
    reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");

    const fs = await import("fs/promises");
    const path = await import("path");
    const indexPath = path.join(__dirname, "../dist-frontend/index.html");
    const html = await fs.readFile(indexPath, "utf-8");

    reply.type("text/html").send(html);
  });

  fastify.get("/select-user", async (request, reply) => {
    reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");

    const fs = await import("fs/promises");
    const path = await import("path");
    const indexPath = path.join(__dirname, "../dist-frontend/index.html");
    const html = await fs.readFile(indexPath, "utf-8");

    reply.type("text/html").send(html);
  });

  fastify.get("/pkce/select-user", async (request, reply) => {
    reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");

    const fs = await import("fs/promises");
    const path = await import("path");
    const indexPath = path.join(__dirname, "../dist-frontend/index.html");
    const html = await fs.readFile(indexPath, "utf-8");

    reply.type("text/html").send(html);
  });

  fastify.get("/health", async () => ({
    status: "ok",
    service: "phoenix-oidc-dev",
    timestamp: new Date().toISOString(),
    users: oidcServer.getUsers().length,
  }));

  fastify.get("/.well-known/openid-configuration", async (request) => {
    const discoveryRequest = {
      timestamp: new Date().toISOString(),
      event: "openid_discovery_document_requested",
      client_ip: request.ip,
      user_agent:
        request.headers["user-agent"]?.substring(0, 100) + "..." || "unknown",
      debug_request_context: {
        likely_phoenix_client:
          request.headers["user-agent"]?.includes("Phoenix") || false,
        likely_grafana_client:
          request.headers["user-agent"]?.includes("Grafana") || false,
        request_from_localhost:
          request.ip === "127.0.0.1" || request.ip?.includes("172.18."),
        headers_count: Object.keys(request.headers).length,
      },
      phoenix_debug_hint:
        "Phoenix should discover PKCE support from code_challenge_methods_supported field",
    };
    console.log(JSON.stringify(discoveryRequest));

    const discoveryDoc = oidcServer.getDiscoveryDocument();

    const discoveryResponse = {
      timestamp: new Date().toISOString(),
      event: "openid_discovery_document_returned",
      pkce_methods_advertised: discoveryDoc.code_challenge_methods_supported,
      endpoints_advertised: {
        authorization_endpoint: discoveryDoc.authorization_endpoint,
        token_endpoint: discoveryDoc.token_endpoint,
        userinfo_endpoint: discoveryDoc.userinfo_endpoint,
        jwks_uri: discoveryDoc.jwks_uri,
      },
      debug_phoenix_integration: {
        pkce_auth_endpoint_available: "/pkce/auth",
        pkce_token_endpoint_available: "/pkce/token",
        supports_s256_method: true,
        supports_plain_method: true,
      },
    };
    console.log(JSON.stringify(discoveryResponse));

    return discoveryDoc;
  });

  fastify.get("/.well-known/jwks.json", async () => {
    return oidcServer.getJWKS();
  });
  fastify.get("/auth", async (request, reply) => {
    const query = request.query as any;

    // Auto-detect PKCE flow based on presence of code_challenge
    const isPKCE = !!(query.code_challenge && query.code_challenge_method);

    Logger.logEvent("auth_request_received", {
      flow_type: isPKCE ? "pkce" : "standard_oauth",
      has_code_challenge: !!query.code_challenge,
      code_challenge_method: query.code_challenge_method || "none",
      client_id: query.client_id,
      client_auth_method: OIDC_CLIENT_AUTH_METHOD,
      comprehensive_debug: {
        full_query_params: query,
        full_headers: request.headers,
        user_agent: request.headers["user-agent"] || "none",
        referer: request.headers["referer"] || "none",
        request_ip:
          request.headers["x-forwarded-for"] ||
          request.headers["x-real-ip"] ||
          "internal",
        pkce_parameters: {
          code_challenge: query.code_challenge || "none",
          code_challenge_method: query.code_challenge_method || "none",
          code_challenge_length: query.code_challenge?.length || 0,
        },
        oauth_parameters: {
          response_type: query.response_type,
          scope: query.scope,
          state: query.state,
          redirect_uri: query.redirect_uri,
          nonce: query.nonce,
        },
      },
    });

    const result = isPKCE
      ? await oidcServer.handlePKCEAuth(query)
      : await oidcServer.handleAuth(query);

    // If there's a valid redirectUrl, use it (even if there's an error - this follows OAuth2 spec)
    // Only show custom error page when there's no valid redirect_uri (completely malformed requests)
    if (result.redirectUrl) {
      return reply.redirect(result.redirectUrl);
    }

    // No valid redirect_uri, show error page on OIDC server
    if (result.error) {
      const errorUrl = `${PUBLIC_BASE_URL}/?error=${encodeURIComponent(result.error)}&error_description=${encodeURIComponent(result.error_description || "")}&state=${encodeURIComponent(query.state || "")}`;
      return reply.redirect(errorUrl);
    }

    // This should not happen, but just in case
    return reply.code(500).send({
      error: "server_error",
      error_description: "Invalid server response",
    });
  });

  fastify.post("/token", async (request, reply) => {
    const body = request.body as any;
    const headers = request.headers;

    // Auto-detect PKCE flow based on presence of code_verifier
    const isPKCE = !!body.code_verifier;

    Logger.logEvent("token_request_received", {
      flow_type: isPKCE ? "pkce" : "standard_oauth",
      has_code_verifier: !!body.code_verifier,
      grant_type: body.grant_type,
      client_id: body.client_id,
      has_authorization_header: !!headers.authorization,
      client_auth_method: OIDC_CLIENT_AUTH_METHOD,
      comprehensive_debug: {
        full_headers: headers,
        full_body: body,
        authorization_header_raw: headers.authorization || "none",
        user_agent: headers["user-agent"] || "none",
        content_type: headers["content-type"] || "none",
        content_length: headers["content-length"] || "none",
        request_ip:
          headers["x-forwarded-for"] || headers["x-real-ip"] || "internal",
      },
    });

    const result = isPKCE
      ? await oidcServer.handlePKCEToken(body, headers)
      : await oidcServer.handleToken(body, headers);

    if (result.error) {
      return reply.code(400).send({
        error: result.error,
        error_description: result.error_description || "Token request failed",
      });
    }

    return result.tokens;
  });

  fastify.get("/userinfo", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const result = await oidcServer.handleUserInfo(authHeader);

    if (result.error) {
      return reply.code(401).send({ error: result.error });
    }

    return result.user;
  });

  fastify.get("/api/users", async () => {
    return oidcServer.getUsers();
  });
  fastify.get("/api/select-user", async (request, reply) => {
    const query = request.query as any;
    const { userId, ...authParams } = query;

    const userSelectionStart = {
      timestamp: new Date().toISOString(),
      event: "user_selection_request_started",
      user_id: userId,
      auth_params: authParams,
    };
    console.log(JSON.stringify(userSelectionStart));

    if (!userId) {
      const missingUserId = {
        timestamp: new Date().toISOString(),
        event: "user_selection_validation_failed",
        error: "missing_user_id",
        required_param: "userId",
      };
      console.log(JSON.stringify(missingUserId));
      return reply.code(400).send({ error: "User ID is required" });
    }

    const result = await oidcServer.handleUserSelection(userId, authParams);

    if (result.error) {
      const selectionError = {
        timestamp: new Date().toISOString(),
        event: "user_selection_failed",
        error: result.error,
        user_id: userId,
      };
      console.log(JSON.stringify(selectionError));
      return reply.code(400).send({ error: result.error });
    }

    const selectionComplete = {
      timestamp: new Date().toISOString(),
      event: "user_selection_completed",
      user_id: userId,
      redirect_url: result.redirectUrl,
      status: "redirecting_to_callback",
    };
    console.log(JSON.stringify(selectionComplete));

    return reply.redirect(result.redirectUrl, 302);
  });

  fastify.get("/api/pkce/select-user", async (request, reply) => {
    const query = request.query as any;
    const { userId, ...authParams } = query;

    const userSelectionStart = {
      timestamp: new Date().toISOString(),
      event: "pkce_user_selection_request_started",
      user_id: userId,
      auth_params: authParams,
    };
    console.log(JSON.stringify(userSelectionStart));

    if (!userId) {
      const missingUserId = {
        timestamp: new Date().toISOString(),
        event: "pkce_user_selection_validation_failed",
        error: "missing_user_id",
        required_param: "userId",
      };
      console.log(JSON.stringify(missingUserId));
      return reply.code(400).send({ error: "User ID is required" });
    }

    const result = await oidcServer.handlePKCEUserSelection(userId, authParams);

    if (result.error) {
      const selectionError = {
        timestamp: new Date().toISOString(),
        event: "pkce_user_selection_failed",
        error: result.error,
        user_id: userId,
      };
      console.log(JSON.stringify(selectionError));
      return reply.code(400).send({ error: result.error });
    }

    const selectionComplete = {
      timestamp: new Date().toISOString(),
      event: "pkce_user_selection_completed",
      user_id: userId,
      redirect_url: result.redirectUrl,
      status: "redirecting_to_callback",
    };
    console.log(JSON.stringify(selectionComplete));

    return reply.redirect(result.redirectUrl, 302);
  });
}

async function start() {
  try {
    await oidcServer.initialize();

    await setupPlugins();
    await setupRoutes();
    await fastify.listen({ port: PORT, host: "0.0.0.0" });

    Logger.logEvent("phoenix_oidc_server_started", {
      protocol: "HTTP",
      port: PORT,
      internal_server: ISSUER,
      public_base_url: PUBLIC_BASE_URL,
      user_source: "dynamic_from_postgresql",
      discovery_endpoint: `${ISSUER}/.well-known/openid-configuration`,
      status: "ready_for_connections",
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  const shutdownStart = {
    timestamp: new Date().toISOString(),
    event: "server_shutdown_initiated",
    signal: "SIGINT",
  };
  console.log(JSON.stringify(shutdownStart));

  try {
    await oidcServer.cleanup();
    await fastify.close();

    const shutdownComplete = {
      timestamp: new Date().toISOString(),
      event: "server_shutdown_completed",
      status: "graceful_shutdown_successful",
    };
    console.log(JSON.stringify(shutdownComplete));
    process.exit(0);
  } catch (err) {
    const shutdownError = {
      timestamp: new Date().toISOString(),
      event: "server_shutdown_failed",
      error: err instanceof Error ? err.message : String(err),
    };
    console.log(JSON.stringify(shutdownError));
    process.exit(1);
  }
});

start();
