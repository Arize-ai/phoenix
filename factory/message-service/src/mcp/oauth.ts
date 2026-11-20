import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { getDatabase } from "@/db/client";
import type { McpOauthGrants } from "@/db/generated";
import { getMcpConfig } from "@/workers/config";
import { errors, jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { Insertable, Selectable } from "kysely";
import { z } from "zod";

const ACCESS_LIFETIME_SECONDS = 300;
const GRANT_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

export function getOAuthTokenEndpoint(): string {
  const endpoint = new URL(getMcpConfig().FACTORY_MCP_URL);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/oauth/token`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.href;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function matchesSecret({
  secret,
  hash,
}: {
  secret: string;
  hash: string;
}): boolean {
  return timingSafeEqual(
    Buffer.from(hashSecret(secret), "hex"),
    Buffer.from(hash, "hex")
  );
}

async function issueToken({
  grantId,
  resource,
  purpose,
  expiresAt,
  now,
}: {
  grantId: string;
  resource: string;
  purpose: "access" | "refresh";
  expiresAt: number;
  now: number;
}): Promise<string> {
  const config = getMcpConfig();
  return new SignJWT({ purpose, scope: "mcp", client_id: grantId })
    .setProtectedHeader({
      alg: "HS256",
      typ: purpose === "access" ? "at+jwt" : "JWT",
    })
    .setIssuer(getOAuthTokenEndpoint())
    .setAudience(purpose === "access" ? resource : getOAuthTokenEndpoint())
    .setSubject(grantId)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(config.FACTORY_MCP_BEARER_SECRET));
}

export async function verifyOAuthToken({
  token,
  purpose,
}: {
  token: string;
  purpose: "access" | "refresh";
}): Promise<JWTPayload | undefined> {
  const config = getMcpConfig();
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(config.FACTORY_MCP_BEARER_SECRET),
      {
        algorithms: ["HS256"],
        typ: purpose === "access" ? "at+jwt" : "JWT",
        issuer: getOAuthTokenEndpoint(),
        audience:
          purpose === "access"
            ? config.FACTORY_MCP_URL
            : getOAuthTokenEndpoint(),
        requiredClaims: ["sub", "jti", "iat", "exp", "scope", "client_id"],
      }
    );
    if (payload.purpose !== purpose || payload.client_id !== payload.sub)
      return;
    return payload;
  } catch (error) {
    if (!(error instanceof errors.JOSEError)) throw error;
  }
}

export async function prepareMcpGrant({
  now = new Date(),
  accessLifetimeSeconds = ACCESS_LIFETIME_SECONDS,
}: { now?: Date; accessLifetimeSeconds?: number } = {}): Promise<{
  record: Omit<Insertable<McpOauthGrants>, "session_id">;
  auth: {
    type: "mcp_oauth";
    mcp_server_url: string;
    access_token: string;
    expires_at: string;
    refresh: {
      client_id: string;
      refresh_token: string;
      token_endpoint: string;
      token_endpoint_auth: {
        type: "client_secret_basic";
        client_secret: string;
      };
      resource: string;
      scope: string;
    };
  };
}> {
  const config = getMcpConfig();
  const grantId = randomUUID();
  const clientSecret = randomBytes(32).toString("base64url");
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt =
    issuedAt +
    Math.min(ACCESS_LIFETIME_SECONDS, Math.max(1, accessLifetimeSeconds));
  const grantExpiresAt = issuedAt + GRANT_LIFETIME_SECONDS;
  const refreshToken = await issueToken({
    grantId,
    resource: config.FACTORY_MCP_URL,
    purpose: "refresh",
    expiresAt: grantExpiresAt,
    now: issuedAt,
  });
  return {
    record: {
      id: grantId,
      resource: config.FACTORY_MCP_URL,
      client_secret_hash: hashSecret(clientSecret),
      refresh_token_hash: hashSecret(refreshToken),
      expires_at: new Date(grantExpiresAt * 1000),
    },
    auth: {
      type: "mcp_oauth",
      mcp_server_url: config.FACTORY_MCP_URL,
      access_token: await issueToken({
        grantId,
        resource: config.FACTORY_MCP_URL,
        purpose: "access",
        expiresAt,
        now: issuedAt,
      }),
      expires_at: new Date(expiresAt * 1000).toISOString(),
      refresh: {
        client_id: grantId,
        refresh_token: refreshToken,
        token_endpoint: getOAuthTokenEndpoint(),
        token_endpoint_auth: {
          type: "client_secret_basic",
          client_secret: clientSecret,
        },
        resource: config.FACTORY_MCP_URL,
        scope: "mcp",
      },
    },
  };
}

type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "invalid_target"
  | "unsupported_grant_type";
type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: "mcp";
};
type GrantResult =
  | { tokens: TokenResponse }
  | { error: OAuthErrorCode }
  | { revoked: true };

function validateRefreshGrant({
  grant,
  payload,
  parameters,
  now,
  resource,
}: {
  grant: Selectable<McpOauthGrants>;
  payload: JWTPayload | undefined;
  parameters: URLSearchParams;
  now: Date;
  resource: string;
}): OAuthErrorCode | undefined {
  if (
    grant.revoked_at ||
    grant.expires_at <= now ||
    grant.resource !== resource ||
    payload?.sub !== grant.id
  )
    return "invalid_grant";
  if (parameters.has("scope") && parameters.get("scope") !== "mcp")
    return "invalid_scope";
  if (
    parameters.has("resource") &&
    parameters.get("resource") !== grant.resource
  )
    return "invalid_target";
}

function respondOAuth(result: GrantResult): Response {
  const headers = new Headers({
    "cache-control": "no-store",
    pragma: "no-cache",
  });
  if ("error" in result) {
    if (result.error === "invalid_client")
      headers.set("www-authenticate", 'Basic realm="Factory OAuth"');
    return Response.json(
      { error: result.error },
      { status: result.error === "invalid_client" ? 401 : 400, headers }
    );
  }
  return "revoked" in result
    ? new Response(null, { status: 200, headers })
    : Response.json(result.tokens, { headers });
}

export async function handleOAuthRequest({
  request,
  operation,
}: {
  request: Request;
  operation: "refresh" | "revoke";
}): Promise<Response> {
  try {
    getMcpConfig();
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    return Response.json(
      { error: "server_error" },
      {
        status: 503,
        headers: { "cache-control": "no-store", pragma: "no-cache" },
      }
    );
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/x-www-form-urlencoded"
  )
    return respondOAuth({ error: "invalid_request" });
  const body = await request.text();
  if (body.length > 16384) return respondOAuth({ error: "invalid_request" });
  const parameters = new URLSearchParams(body);
  if (
    [...parameters.keys()].some((key) => parameters.getAll(key).length !== 1) ||
    parameters.has("client_secret")
  )
    return respondOAuth({ error: "invalid_request" });
  const authorization = request.headers.get("authorization");
  const encoded = authorization?.match(/^Basic (.+)$/i)?.[1];
  if (!encoded) return respondOAuth({ error: "invalid_client" });
  if (encoded.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    return respondOAuth({ error: "invalid_client" });
  const credentials = Buffer.from(encoded, "base64").toString();
  const separator = credentials.indexOf(":");
  if (separator < 1) return respondOAuth({ error: "invalid_client" });
  let clientId: string;
  let clientSecret: string;
  try {
    clientId = decodeURIComponent(
      credentials.slice(0, separator).replaceAll("+", " ")
    );
    clientSecret = decodeURIComponent(
      credentials.slice(separator + 1).replaceAll("+", " ")
    );
  } catch (error) {
    if (!(error instanceof URIError)) throw error;
    return respondOAuth({ error: "invalid_client" });
  }
  if (
    !z.uuid().safeParse(clientId).success ||
    !clientSecret ||
    (parameters.has("client_id") && parameters.get("client_id") !== clientId)
  )
    return respondOAuth({ error: "invalid_client" });
  const result = await getDatabase()
    .transaction()
    .execute(async (transaction): Promise<GrantResult> => {
      const grant = await transaction
        .selectFrom("mcp_oauth_grants")
        .selectAll()
        .where("id", "=", clientId)
        .forUpdate()
        .executeTakeFirst();
      if (
        !grant ||
        !matchesSecret({ secret: clientSecret, hash: grant.client_secret_hash })
      )
        return { error: "invalid_client" };
      if (operation === "refresh" && !parameters.has("grant_type"))
        return { error: "invalid_request" };
      if (
        operation === "refresh" &&
        parameters.get("grant_type") !== "refresh_token"
      )
        return { error: "unsupported_grant_type" };
      const token = parameters.get(
        operation === "refresh" ? "refresh_token" : "token"
      );
      if (!token) return { error: "invalid_request" };
      const payload = await verifyOAuthToken({ token, purpose: "refresh" });
      if (operation === "revoke") {
        const ownedToken =
          payload ?? (await verifyOAuthToken({ token, purpose: "access" }));
        if (ownedToken?.sub === grant.id)
          await transaction
            .updateTable("mcp_oauth_grants")
            .set({ revoked_at: new Date() })
            .where("id", "=", grant.id)
            .execute();
        return { revoked: true };
      }
      const now = new Date();
      const rejection = validateRefreshGrant({
        grant,
        payload,
        parameters,
        now,
        resource: getMcpConfig().FACTORY_MCP_URL,
      });
      if (rejection) return { error: rejection };
      if (!matchesSecret({ secret: token, hash: grant.refresh_token_hash })) {
        await transaction
          .updateTable("mcp_oauth_grants")
          .set({ revoked_at: now })
          .where("id", "=", grant.id)
          .execute();
        return { error: "invalid_grant" };
      }
      const thread = await transaction
        .selectFrom("slack_threads")
        .select("session_id")
        .where("session_id", "=", grant.session_id)
        .executeTakeFirst();
      if (!thread) return { error: "invalid_grant" };
      const issuedAt = Math.floor(now.getTime() / 1000);
      const accessExpiry = Math.min(
        issuedAt + ACCESS_LIFETIME_SECONDS,
        Math.floor(grant.expires_at.getTime() / 1000)
      );
      const refreshToken = await issueToken({
        grantId: grant.id,
        resource: grant.resource,
        purpose: "refresh",
        expiresAt: Math.floor(grant.expires_at.getTime() / 1000),
        now: issuedAt,
      });
      const accessToken = await issueToken({
        grantId: grant.id,
        resource: grant.resource,
        purpose: "access",
        expiresAt: accessExpiry,
        now: issuedAt,
      });
      await transaction
        .updateTable("mcp_oauth_grants")
        .set({ refresh_token_hash: hashSecret(refreshToken) })
        .where("id", "=", grant.id)
        .execute();
      return {
        tokens: {
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: accessExpiry - issuedAt,
          refresh_token: refreshToken,
          scope: "mcp",
        },
      };
    });
  return respondOAuth(result);
}
