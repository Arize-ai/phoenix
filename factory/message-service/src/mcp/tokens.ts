import { createHmac, timingSafeEqual } from "node:crypto";
import { getMcpConfig } from "@/workers/config";

function signPayload(payload: string): Buffer {
  const config = getMcpConfig();
  return createHmac("sha256", config.FACTORY_MCP_BEARER_SECRET)
    .update(`${config.FACTORY_MCP_URL}\n${payload}`)
    .digest();
}

export function signToken(claims: object): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signPayload(payload).toString("base64url")}`;
}

export function readSignedToken(token: string): unknown {
  if (token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))
    return;
  const [payload, signature] = token.split(".");
  const actual = Buffer.from(signature, "base64url");
  const expected = signPayload(payload);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
}
