import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const slackEnvelopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("url_verification"), challenge: z.string() }),
  z.object({
    type: z.literal("event_callback"),
    team_id: z.string().min(1),
    event_id: z.string().min(1),
    event: z.object({
      type: z.string(),
      channel: z.string().optional(),
      user: z.string().optional(),
      text: z.string().optional(),
      ts: z.string().optional(),
      thread_ts: z.string().optional(),
      subtype: z.string().optional(),
      bot_id: z.string().optional(),
    }),
  }),
]);

export type SlackEnvelope = z.infer<typeof slackEnvelopeSchema>;

export type ThreadMessage = {
  workspaceId: string;
  channelId: string;
  threadTimestamp: string;
  messageTimestamp: string;
  userId: string;
  text: string;
  isMention: boolean;
};

export function verifySlackSignature({
  body,
  signature,
  timestamp,
  signingSecret,
  now = Date.now(),
}: {
  body: string;
  signature: string | null;
  timestamp: string | null;
  signingSecret: string;
  now?: number;
}): boolean {
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

export function parseThreadMessage({
  envelope,
  botUserId,
}: {
  envelope: SlackEnvelope;
  botUserId: string;
}): ThreadMessage | undefined {
  if (envelope.type !== "event_callback") return;
  const { event } = envelope;
  if (event.type !== "app_mention" && event.type !== "message") return;
  if (event.subtype || event.bot_id || event.user === botUserId) return;
  if (!event.user || !event.channel || !event.ts || !event.text) return;
  return {
    workspaceId: envelope.team_id,
    channelId: event.channel,
    threadTimestamp: event.thread_ts ?? event.ts,
    messageTimestamp: event.ts,
    userId: event.user,
    text: event.text,
    isMention:
      event.type === "app_mention" || event.text.includes(`<@${botUserId}>`),
  };
}
