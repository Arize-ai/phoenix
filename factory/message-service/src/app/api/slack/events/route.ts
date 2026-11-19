import { getServiceConfig } from "@/config";
import { deliverThreadMessage } from "@/messages/coordinator";
import { messageDispatcher } from "@/messages/runtime";
import {
  parseThreadMessage,
  slackEnvelopeSchema,
  verifySlackSignature,
} from "@/slack/events";
import { after } from "next/server";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret)
    return Response.json(
      { error: "Service is not configured." },
      { status: 503 }
    );
  const body = await request.text();
  if (
    !verifySlackSignature({
      body,
      signingSecret,
      signature: request.headers.get("x-slack-signature"),
      timestamp: request.headers.get("x-slack-request-timestamp"),
    })
  )
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = slackEnvelopeSchema.safeParse(payload);
  if (!parsed.success)
    return Response.json({ error: "Invalid event." }, { status: 400 });
  if (parsed.data.type === "url_verification")
    return Response.json({ challenge: parsed.data.challenge });
  const configResult = (() => {
    try {
      return getServiceConfig();
    } catch (error) {
      if (error instanceof ZodError) return;
      throw error;
    }
  })();
  if (!configResult)
    return Response.json(
      { error: "Service is not configured." },
      { status: 503 }
    );
  const message = parseThreadMessage({
    envelope: parsed.data,
    botUserId: configResult.SLACK_BOT_USER_ID,
  });
  if (
    !message ||
    message.workspaceId !== configResult.SLACK_WORKSPACE_ID ||
    !configResult.SLACK_ALLOWED_USER_IDS.has(message.userId)
  ) {
    return new Response(null, { status: 200 });
  }
  after(async () => {
    await messageDispatcher.dispatch({
      threadKey: JSON.stringify([
        message.workspaceId,
        message.channelId,
        message.threadTimestamp,
      ]),
      messageKey: JSON.stringify([
        message.workspaceId,
        message.channelId,
        message.messageTimestamp,
      ]),
      deliver: () => deliverThreadMessage({ message, config: configResult }),
    });
  });
  return new Response(null, { status: 200 });
}
