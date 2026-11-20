import { randomUUID } from "node:crypto";
import { decodeJwt, SignJWT } from "jose";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";

import { POST as revoke } from "../src/app/api/mcp/oauth/revoke/route";
import { POST as refresh } from "../src/app/api/mcp/oauth/token/route";
import { POST as receiveMcp } from "../src/app/api/mcp/route";
import { getDatabase } from "../src/db/client";
import { deleteExpiredMcpGrants } from "../src/mcp/cleanup";
import { getOAuthTokenEndpoint, prepareMcpGrant } from "../src/mcp/oauth";
import { signToken } from "../src/mcp/tokens";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const resource = "https://factory.example.com/api/mcp";
let grant: Awaited<ReturnType<typeof prepareMcpGrant>>;

async function createGrant(
  sessionId: string
): Promise<Awaited<ReturnType<typeof prepareMcpGrant>>> {
  await pool.query("INSERT INTO sessions(id,kind) VALUES ($1,'foreman')", [
    sessionId,
  ]);
  await pool.query(
    "INSERT INTO slack_threads(workspace_id,channel_id,thread_timestamp,session_id) VALUES ('team','channel',$1,$1)",
    [sessionId]
  );
  const prepared = await prepareMcpGrant();
  await getDatabase()
    .insertInto("mcp_oauth_grants")
    .values({ ...prepared.record, session_id: sessionId })
    .execute();
  return prepared;
}

beforeEach(async () => {
  vi.stubEnv("FACTORY_MCP_URL", resource);
  vi.stubEnv("FACTORY_MCP_BEARER_SECRET", "a".repeat(32));
  await pool.query("TRUNCATE slack_threads,sessions CASCADE");
  grant = await createGrant("foreman");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await pool.end();
  await getDatabase().destroy();
});

function createRequest({
  token = grant.auth.refresh.refresh_token,
  clientId = grant.auth.refresh.client_id,
  secret = grant.auth.refresh.token_endpoint_auth.client_secret,
  parameters = {},
  operation = "refresh",
}: {
  token?: string;
  clientId?: string;
  secret?: string;
  parameters?: Record<string, string>;
  operation?: "refresh" | "revoke";
} = {}): Request {
  return new Request(
    `${resource}/oauth/${operation === "refresh" ? "token" : "revoke"}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      },
      body: new URLSearchParams(
        operation === "refresh"
          ? { grant_type: "refresh_token", refresh_token: token, ...parameters }
          : { token, ...parameters }
      ),
    }
  );
}

async function callMcp(token: string): Promise<Response> {
  return receiveMcp(
    new Request(resource, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    })
  );
}

it("provisions confidential renewable credentials with short-lived access and only hashes persisted", async () => {
  expect(grant.auth.type).toBe("mcp_oauth");
  expect(grant.auth.refresh.token_endpoint_auth.type).toBe(
    "client_secret_basic"
  );
  const claims = decodeJwt(grant.auth.access_token);
  expect(claims.exp! - claims.iat!).toBe(300);
  expect(claims).toMatchObject({
    sub: grant.record.id,
    purpose: "access",
    scope: "mcp",
    aud: resource,
    iss: getOAuthTokenEndpoint(),
  });
  const stored = (await pool.query("SELECT * FROM mcp_oauth_grants")).rows[0];
  expect(stored.session_id).toBe("foreman");
  for (const secret of [
    grant.auth.access_token,
    grant.auth.refresh.refresh_token,
    grant.auth.refresh.token_endpoint_auth.client_secret,
  ])
    expect(JSON.stringify(stored)).not.toContain(secret);
  expect((await callMcp(grant.auth.access_token)).status).toBe(200);
  expect((await callMcp(grant.auth.refresh.refresh_token)).status).toBe(401);
  expect(
    (
      await callMcp(
        signToken({
          purpose: "foreman",
          workspace_id: "team",
          channel_id: "channel",
          thread_timestamp: "foreman",
        })
      )
    ).status
  ).toBe(401);
});

it.each([
  { exp: 1 },
  { aud: "https://other.example/mcp" },
  { iss: "https://other.example/token" },
  { alg: "HS384" },
  { typ: "JWT" },
  { sub: randomUUID() },
  { purpose: "refresh" },
])(
  "rejects invalid access JWT claims %j with the SDK challenge",
  async (overrides) => {
    const { alg = "HS256", typ = "at+jwt", ...claims } = overrides;
    const accessToken = await new SignJWT({
      purpose: "access",
      scope: "mcp",
      client_id: grant.record.id,
      ...claims,
    })
      .setProtectedHeader({ alg, typ })
      .setSubject(claims.sub ?? String(grant.record.id))
      .setIssuer(claims.iss ?? getOAuthTokenEndpoint())
      .setAudience(claims.aud ?? resource)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(claims.exp ?? "1h")
      .sign(new TextEncoder().encode("a".repeat(32)));
    const response = await callMcp(accessToken);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
  }
);

it("uses SDK scope enforcement for correctly signed access without MCP scope", async () => {
  const token = await new SignJWT({
    purpose: "access",
    scope: "other",
    client_id: grant.record.id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setSubject(String(grant.record.id))
    .setIssuer(getOAuthTokenEndpoint())
    .setAudience(resource)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("a".repeat(32)));
  const response = await callMcp(token);
  expect(response.status).toBe(403);
  expect(response.headers.get("www-authenticate")).toContain(
    "insufficient_scope"
  );
});

it("rotates refresh credentials twice, preserves absolute expiry, and authenticates the same Foreman", async () => {
  const originalExpiry = grant.record.expires_at;
  const first = await refresh(createRequest());
  expect(first.status).toBe(200);
  expect(first.headers.get("cache-control")).toBe("no-store");
  expect(first.headers.get("pragma")).toBe("no-cache");
  const initial = await first.json();
  expect(initial).toMatchObject({
    token_type: "Bearer",
    expires_in: 300,
    scope: "mcp",
  });
  expect(initial.refresh_token).not.toBe(grant.auth.refresh.refresh_token);
  expect((await callMcp(initial.access_token)).status).toBe(200);
  const second = await refresh(createRequest({ token: initial.refresh_token }));
  expect(second.status).toBe(200);
  const renewed = await second.json();
  expect(renewed.refresh_token).not.toBe(initial.refresh_token);
  expect((await callMcp(renewed.access_token)).status).toBe(200);
  const row = await getDatabase()
    .selectFrom("mcp_oauth_grants")
    .selectAll()
    .executeTakeFirstOrThrow();
  expect(row.expires_at).toEqual(originalExpiry);
  expect(row.revoked_at).toBeNull();
});

it("commits replay revocation and invalidates all access and refresh credentials in the family", async () => {
  const accepted = await (await refresh(createRequest())).json();
  const replay = await refresh(createRequest());
  expect(replay.status).toBe(400);
  expect(await replay.json()).toEqual({ error: "invalid_grant" });
  expect((await callMcp(accepted.access_token)).status).toBe(401);
  expect((await callMcp(grant.auth.access_token)).status).toBe(401);
  expect(
    (await refresh(createRequest({ token: accepted.refresh_token }))).status
  ).toBe(400);
  expect(
    (await pool.query("SELECT revoked_at FROM mcp_oauth_grants")).rows[0]
      .revoked_at
  ).not.toBeNull();
});

it("serializes simultaneous refreshes and fails closed on duplicate use", async () => {
  const responses = await Promise.all([
    refresh(createRequest()),
    refresh(createRequest()),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([
    200, 400,
  ]);
  expect((await callMcp(grant.auth.access_token)).status).toBe(401);
});

it("rejects bad client authentication without revoking the legitimate grant", async () => {
  for (const options of [{ secret: "wrong" }, { clientId: randomUUID() }]) {
    const response = await refresh(createRequest(options));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_client" });
    expect(response.headers.get("www-authenticate")).toContain("Basic");
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  const missing = createRequest();
  missing.headers.delete("authorization");
  expect((await refresh(missing)).status).toBe(401);
  expect((await refresh(createRequest())).status).toBe(200);
});

it("rejects invalid and cross-client refresh tokens without revoking another family", async () => {
  const other = await createGrant("other-foreman");
  for (const token of [
    "not-a-token",
    other.auth.refresh.refresh_token,
    grant.auth.access_token,
  ]) {
    const response = await refresh(createRequest({ token }));
    expect(await response.json()).toEqual({ error: "invalid_grant" });
  }
  expect((await callMcp(grant.auth.access_token)).status).toBe(200);
  expect((await callMcp(other.auth.access_token)).status).toBe(200);
  expect((await refresh(createRequest())).status).toBe(200);
});

it.each([
  [{ scope: "mcp extra" }, "invalid_scope"],
  [{ resource: "https://other.example/mcp" }, "invalid_target"],
  [{ grant_type: "client_credentials" }, "unsupported_grant_type"],
] as const)(
  "rejects refresh escalation or an unsupported grant %j",
  async (parameters, error) => {
    const response = await refresh(createRequest({ parameters }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect((await refresh(createRequest())).status).toBe(200);
  }
);

it("rejects malformed, missing and duplicate form parameters without issuing tokens", async () => {
  const request = createRequest();
  const headers = request.headers;
  for (const body of [
    "grant_type=refresh_token",
    "refresh_token=x",
    "grant_type=refresh_token&grant_type=refresh_token&refresh_token=x",
    "grant_type=refresh_token&refresh_token=x&client_secret=x",
  ]) {
    const response = await refresh(
      new Request(request.url, { method: "POST", headers, body })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
  const jsonRequest = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  expect((await refresh(jsonRequest)).status).toBe(400);
  expect((await refresh(createRequest())).status).toBe(200);
});

it.each(["expired", "revoked", "unmapped"])(
  "invalidates access and refresh for an %s grant",
  async (state) => {
    if (state === "expired")
      await pool.query(
        "UPDATE mcp_oauth_grants SET created_at=now()-interval '91 days', expires_at=now()-interval '1 second'"
      );
    else if (state === "revoked")
      await pool.query("UPDATE mcp_oauth_grants SET revoked_at=now()");
    else await pool.query("DELETE FROM slack_threads");
    expect((await callMcp(grant.auth.access_token)).status).toBe(401);
    expect((await refresh(createRequest())).status).toBe(400);
  }
);

it("supports authenticated RFC 7009 revocation and ignores unknown tokens", async () => {
  expect(
    (await revoke(createRequest({ operation: "revoke", token: "unknown" })))
      .status
  ).toBe(200);
  expect((await callMcp(grant.auth.access_token)).status).toBe(200);
  const rejected = await revoke(
    createRequest({ operation: "revoke", secret: "wrong" })
  );
  expect(rejected.status).toBe(401);
  expect((await callMcp(grant.auth.access_token)).status).toBe(200);
  const response = await revoke(createRequest({ operation: "revoke" }));
  expect(response.status).toBe(200);
  expect((await callMcp(grant.auth.access_token)).status).toBe(401);
  expect((await refresh(createRequest())).status).toBe(400);
});

it("rejects both token types after signing key rotation", async () => {
  vi.stubEnv("FACTORY_MCP_BEARER_SECRET", "b".repeat(32));
  expect((await callMcp(grant.auth.access_token)).status).toBe(401);
  expect((await refresh(createRequest())).status).toBe(400);
});

it("enforces Foreman-only grant ownership, unique identity and hash/expiry constraints", async () => {
  await pool.query("INSERT INTO sessions(id,kind) VALUES ('worker','worker')");
  await expect(
    pool.query("UPDATE mcp_oauth_grants SET session_id='worker'")
  ).rejects.toMatchObject({ code: "23503" });
  await expect(
    pool.query("UPDATE mcp_oauth_grants SET refresh_token_hash='plaintext'")
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    pool.query("UPDATE mcp_oauth_grants SET expires_at=created_at")
  ).rejects.toMatchObject({ code: "23514" });
});

it("deletes only expired grants while preserving sessions, Slack mappings and unexpired grants", async () => {
  for (const sessionId of [
    "expired",
    "boundary",
    "expired-revoked",
    "unexpired-revoked",
  ])
    await createGrant(sessionId);
  await pool.query(
    "UPDATE mcp_oauth_grants SET created_at=now()-interval '91 days', expires_at=now()-interval '1 second' WHERE session_id IN ('expired','expired-revoked')"
  );
  await pool.query(
    "UPDATE mcp_oauth_grants SET created_at=now()-interval '1 day', expires_at=now() WHERE session_id='boundary'"
  );
  await pool.query(
    "UPDATE mcp_oauth_grants SET revoked_at=now() WHERE session_id IN ('expired-revoked','unexpired-revoked')"
  );
  await deleteExpiredMcpGrants();
  expect(
    (
      await pool.query(
        "SELECT session_id FROM mcp_oauth_grants ORDER BY session_id"
      )
    ).rows
  ).toEqual([{ session_id: "foreman" }, { session_id: "unexpired-revoked" }]);
  expect(
    (await pool.query("SELECT count(*)::int AS count FROM sessions")).rows[0]
      .count
  ).toBe(5);
  expect(
    (await pool.query("SELECT count(*)::int AS count FROM slack_threads"))
      .rows[0].count
  ).toBe(5);
  expect((await callMcp(grant.auth.access_token)).status).toBe(200);
  await deleteExpiredMcpGrants();
  expect(
    (await pool.query("SELECT count(*)::int AS count FROM mcp_oauth_grants"))
      .rows[0].count
  ).toBe(2);
});

it("preserves an unexpired grant during concurrent refresh and revocation", async () => {
  const [refreshed] = await Promise.all([
    refresh(createRequest()),
    deleteExpiredMcpGrants(),
  ]);
  expect(refreshed.status).toBe(200);
  const tokens = await refreshed.json();
  const [revoked] = await Promise.all([
    revoke(createRequest({ token: tokens.refresh_token, operation: "revoke" })),
    deleteExpiredMcpGrants(),
  ]);
  expect(revoked.status).toBe(200);
  const row = (await pool.query("SELECT revoked_at FROM mcp_oauth_grants"))
    .rows[0];
  expect(row.revoked_at).not.toBeNull();
  expect((await callMcp(tokens.access_token)).status).toBe(401);
});
