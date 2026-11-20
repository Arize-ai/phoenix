import { getDatabase } from "@/db/client";
import { getMcpConfig } from "@/workers/config";
import { z } from "zod";

import { readSignedToken, signToken } from "./tokens";

const callerSchema = z.object({
  purpose: z.literal("foreman"),
  workspace_id: z.string().min(1),
  channel_id: z.string().min(1),
  thread_timestamp: z.string().min(1),
});

export function createMcpToken(thread: {
  workspace_id: string;
  channel_id: string;
  thread_timestamp: string;
}): string {
  return signToken({ purpose: "foreman", ...thread });
}

export async function authenticateForeman(
  request: Request
): Promise<string | undefined> {
  const config = getMcpConfig();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(config.FACTORY_MCP_URL).origin) return;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return;
  const caller = callerSchema.safeParse(
    readSignedToken(authorization.slice(7))
  );
  if (!caller.success) return;
  const thread = await getDatabase()
    .selectFrom("slack_threads")
    .select("session_id")
    .where("workspace_id", "=", caller.data.workspace_id)
    .where("channel_id", "=", caller.data.channel_id)
    .where("thread_timestamp", "=", caller.data.thread_timestamp)
    .executeTakeFirst();
  return thread?.session_id;
}
