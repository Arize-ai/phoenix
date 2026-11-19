import { z } from "zod";

const slackResultSchema = z.object({ ok: z.boolean() });
const slackThreadSchema = slackResultSchema.extend({
  messages: z
    .array(
      z.object({
        user: z.string().optional(),
        text: z.string().optional(),
        ts: z.string(),
      })
    )
    .optional(),
  response_metadata: z
    .object({ next_cursor: z.string().optional() })
    .optional(),
});

export async function readSlackThread({
  channelId,
  threadTimestamp,
  latestTimestamp,
}: {
  channelId: string;
  threadTimestamp: string;
  latestTimestamp: string;
}): Promise<
  { user_id: string | undefined; text: string; message_timestamp: string }[]
> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is required.");
  const messages: {
    user_id: string | undefined;
    text: string;
    message_timestamp: string;
  }[] = [];
  let cursor = "";
  do {
    const query = new URLSearchParams({
      channel: channelId,
      ts: threadTimestamp,
      latest: latestTimestamp,
      inclusive: "true",
      limit: "100",
    });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(
      `https://slack.com/api/conversations.replies?${query}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!response.ok) throw new Error("Slack thread lookup failed.");
    const result = slackThreadSchema.parse(await response.json());
    if (!result.ok || !result.messages)
      throw new Error("Slack rejected thread lookup.");
    messages.push(
      ...result.messages.map((message) => ({
        user_id: message.user,
        text: message.text ?? "",
        message_timestamp: message.ts,
      }))
    );
    cursor = result.response_metadata?.next_cursor ?? "";
  } while (cursor);
  return messages;
}

export async function postThreadReply({
  channelId,
  threadTimestamp,
  text,
}: {
  channelId: string;
  threadTimestamp: string;
  text: string;
}): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is required.");
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: channelId,
      thread_ts: threadTimestamp,
      text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Slack message delivery failed.");
  const result = slackResultSchema.parse(await response.json());
  if (!result.ok) throw new Error("Slack rejected message delivery.");
}
