import { getDatabase } from "@/db/client";
import { getMcpConfig } from "@/workers/config";
import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { z } from "zod";

import { verifyOAuthToken } from "./oauth";

const accessClaimsSchema = z.object({
  sub: z.uuid(),
  scope: z.string(),
  exp: z.number(),
});

export const foremanTokenVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const payload = accessClaimsSchema.safeParse(
      await verifyOAuthToken({ token, purpose: "access" })
    );
    if (!payload.success)
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token");
    const grant = await getDatabase()
      .selectFrom("mcp_oauth_grants")
      .innerJoin(
        "slack_threads",
        "slack_threads.session_id",
        "mcp_oauth_grants.session_id"
      )
      .select(["mcp_oauth_grants.session_id", "resource"])
      .where("mcp_oauth_grants.id", "=", payload.data.sub)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", new Date())
      .where("resource", "=", getMcpConfig().FACTORY_MCP_URL)
      .executeTakeFirst();
    if (!grant)
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token");
    return {
      token,
      clientId: grant.session_id,
      scopes: payload.data.scope.split(" ").filter(Boolean),
      expiresAt: payload.data.exp,
      resource: new URL(grant.resource),
    };
  },
};
