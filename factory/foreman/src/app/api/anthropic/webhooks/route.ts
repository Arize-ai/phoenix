import { getAnthropicClient } from "@/anthropic/client";
import { getDatabase } from "@/db/client";
import { relayForemanReply } from "@/messages/foreman";
import { messageDispatcher } from "@/messages/runtime";
import { relayWorkerReply } from "@/workers/requests";
import { after } from "next/server";
import { WebhookVerificationError } from "standardwebhooks";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const signingKey = process.env.ANTHROPIC_WEBHOOK_SIGNING_KEY;
  if (!signingKey || !process.env.ANTHROPIC_API_KEY)
    return Response.json(
      { error: "Service is not configured." },
      { status: 503 }
    );
  const body = await request.text();
  let event;
  try {
    event = getAnthropicClient().beta.webhooks.unwrap(body, {
      headers: Object.fromEntries(request.headers),
      key: signingKey,
    });
  } catch (error) {
    if (
      !(error instanceof WebhookVerificationError) &&
      !(error instanceof SyntaxError)
    )
      throw error;
    return Response.json({ error: "Invalid webhook." }, { status: 401 });
  }
  if (
    event.data.type === "session.status_idled" ||
    event.data.type === "session.status_terminated"
  ) {
    if (
      process.env.ANTHROPIC_WORKSPACE_ID &&
      event.data.workspace_id !== process.env.ANTHROPIC_WORKSPACE_ID
    )
      return Response.json({ error: "Invalid workspace." }, { status: 403 });
    const sessionId = event.data.id;
    after(() =>
      messageDispatcher.dispatch({
        threadKey: `reply:${sessionId}`,
        messageKey: `anthropic:${event.id}`,
        deliver: async () => {
          const thread = await getDatabase()
            .selectFrom("slack_threads")
            .select("session_id")
            .where("session_id", "=", sessionId)
            .executeTakeFirst();
          if (thread)
            await relayForemanReply({
              sessionId,
              completedAt: event.created_at,
            });
          else
            await relayWorkerReply({
              workerId: sessionId,
              completedAt: event.created_at,
            });
        },
      })
    );
  }
  return new Response(null, { status: 200 });
}
