import { getAnthropicClient } from "@/anthropic/client";
import type { ServiceConfig } from "@/config";
import { getDatabase } from "@/db/client";
import { postThreadReply, readSlackThread } from "@/slack/client";
import type { ThreadMessage } from "@/slack/events";
import { sql } from "kysely";

import { messageDispatcher } from "./runtime";

/** Forward a Slack message to its session, creating one on the first mention. */
export async function deliverThreadMessage({
  message,
  config,
}: {
  message: ThreadMessage;
  config: ServiceConfig;
}): Promise<void> {
  const database = getDatabase();
  const client = getAnthropicClient();
  const threadKey = JSON.stringify([
    message.workspaceId,
    message.channelId,
    message.threadTimestamp,
  ]);
  const delivery = await database.transaction().execute(async (transaction) => {
    await sql`select pg_advisory_xact_lock(hashtextextended(${threadKey}, 0))`.execute(
      transaction
    );
    const thread = await transaction
      .selectFrom("slack_threads")
      .select("session_id")
      .where("workspace_id", "=", message.workspaceId)
      .where("channel_id", "=", message.channelId)
      .where("thread_timestamp", "=", message.threadTimestamp)
      .executeTakeFirst();
    if (thread) return { sessionId: thread.session_id, context: undefined };
    if (!message.isMention) return;
    const context = await readSlackThread({
      channelId: message.channelId,
      threadTimestamp: message.threadTimestamp,
      latestTimestamp: message.messageTimestamp,
    });
    const session = await client.beta.sessions.create({
      agent: config.FACTORY_COORDINATOR_AGENT_ID,
      environment_id: config.FACTORY_COORDINATOR_ENVIRONMENT_ID,
      metadata: {
        slack_workspace: message.workspaceId,
        slack_channel: message.channelId,
        slack_thread_timestamp: message.threadTimestamp,
      },
    });
    await transaction
      .insertInto("sessions")
      .values({ id: session.id, kind: "coordinator" })
      .execute();
    await transaction
      .insertInto("slack_threads")
      .values({
        workspace_id: message.workspaceId,
        channel_id: message.channelId,
        thread_timestamp: message.threadTimestamp,
        session_id: session.id,
      })
      .execute();
    return { sessionId: session.id, context };
  });
  if (!delivery) return;
  await client.beta.sessions.events.send(delivery.sessionId, {
    events: [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              source: "slack",
              user_id: message.userId,
              message_timestamp: message.messageTimestamp,
              text: message.text,
              thread_context: delivery.context,
            }),
          },
        ],
      },
    ],
  });
}

/** Post the latest coordinator reply to its linked Slack thread. */
export async function relayCoordinatorReply(sessionId: string): Promise<void> {
  const thread = await getDatabase()
    .selectFrom("slack_threads")
    .select(["channel_id", "thread_timestamp"])
    .where("session_id", "=", sessionId)
    .executeTakeFirst();
  if (!thread) return;
  const events = await getAnthropicClient().beta.sessions.events.list(
    sessionId,
    {
      types: ["agent.message", "user.message"],
      order: "desc",
      limit: 1,
    }
  );
  const latest = events.data[0];
  if (latest?.type !== "agent.message") return;
  const text = latest.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  if (!text.trim()) return;
  await messageDispatcher.dispatch({
    threadKey: `slack-reply:${sessionId}`,
    messageKey: `agent-message:${sessionId}:${latest.id}`,
    deliver: () =>
      postThreadReply({
        channelId: thread.channel_id,
        threadTimestamp: thread.thread_timestamp,
        text,
      }),
  });
}
