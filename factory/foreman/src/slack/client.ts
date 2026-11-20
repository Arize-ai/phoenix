import { LogLevel, SlackError, WebClient } from "@slack/web-api";

function getSlackClient(): WebClient {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is required.");
  return new WebClient(token, {
    timeout: 15_000,
    retryConfig: { retries: 0 },
    rejectRateLimitedCalls: true,
    logLevel: LogLevel.ERROR,
  });
}

export async function readSlackThread({
  channelId,
  threadTimestamp,
  latestTimestamp,
}: {
  channelId: string;
  threadTimestamp: string;
  latestTimestamp?: string;
}): Promise<
  { user_id: string | undefined; text: string; message_timestamp: string }[]
> {
  const client = getSlackClient();
  const messages: {
    user_id: string | undefined;
    text: string;
    message_timestamp: string;
  }[] = [];
  let cursor: string | undefined;
  try {
    do {
      const result = await client.conversations.replies({
        channel: channelId,
        ts: threadTimestamp,
        latest: latestTimestamp,
        inclusive: true,
        limit: 100,
        cursor,
      });
      if (!result.messages) throw new Error("Slack rejected thread lookup.");
      for (const message of result.messages) {
        if (!message.ts) throw new Error("Slack rejected thread lookup.");
        messages.push({
          user_id: message.user,
          text: message.text ?? "",
          message_timestamp: message.ts,
        });
      }
      cursor = result.response_metadata?.next_cursor;
    } while (cursor);
  } catch (error) {
    if (error instanceof SlackError)
      throw new Error("Slack thread lookup failed.");
    throw error;
  }
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
  const client = getSlackClient();
  try {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTimestamp,
      text,
    });
  } catch (error) {
    if (error instanceof SlackError)
      throw new Error("Slack message delivery failed.");
    throw error;
  }
}
