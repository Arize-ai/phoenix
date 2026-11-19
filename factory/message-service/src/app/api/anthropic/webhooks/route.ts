import { getAnthropicClient } from "@/anthropic/client";
import { relayForemanReply } from "@/messages/foreman";
import { messageDispatcher } from "@/messages/runtime";
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
  if (event.data.type === "session.status_idled") {
    const sessionId = event.data.id;
    after(() =>
      messageDispatcher.dispatch({
        threadKey: `reply:${sessionId}`,
        messageKey: `anthropic:${event.id}`,
        deliver: () => relayForemanReply(sessionId),
      })
    );
  }
  return new Response(null, { status: 200 });
}
