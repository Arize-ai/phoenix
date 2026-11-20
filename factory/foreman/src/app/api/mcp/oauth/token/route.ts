import { handleOAuthRequest } from "@/mcp/oauth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleOAuthRequest({ request, operation: "refresh" });
}
