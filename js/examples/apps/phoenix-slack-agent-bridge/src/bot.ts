import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat, type Message, type Thread } from "chat";

import type { BridgeConfig } from "./config.js";
import { streamPhoenixText } from "./phoenixClient.js";

async function getThreadMessages({
  latestMessage,
  thread,
}: {
  latestMessage: Message;
  thread: Thread;
}): Promise<Message[]> {
  const messages: Message[] = [];
  for await (const message of thread.allMessages) {
    messages.push(message);
  }

  const hasLatestMessage = messages.some(
    (message) => message.id === latestMessage.id
  );
  if (!hasLatestMessage) {
    messages.push(latestMessage);
  }

  return messages;
}

async function postPhoenixResponse({
  config,
  latestMessage,
  thread,
}: {
  config: BridgeConfig;
  latestMessage: Message;
  thread: Thread;
}): Promise<void> {
  const messages = await getThreadMessages({ latestMessage, thread });
  const stream = streamPhoenixText({
    config,
    messages,
    sessionId: thread.id,
  });
  await thread.post(stream);
}

async function handleAgentTurn({
  config,
  latestMessage,
  shouldSubscribe,
  thread,
}: {
  config: BridgeConfig;
  latestMessage: Message;
  shouldSubscribe: boolean;
  thread: Thread;
}): Promise<void> {
  if (shouldSubscribe) {
    await thread.subscribe();
  }
  await thread.startTyping();

  try {
    await postPhoenixResponse({ config, latestMessage, thread });
  } catch (error) {
    console.error("Failed to post Phoenix server-agent response", error);
    await thread.post(
      "Phoenix could not answer this Slack thread. Check the bridge logs for details."
    );
  }
}

export function createBot(config: BridgeConfig) {
  const adapters = {
    slack: createSlackAdapter({
      botToken: config.slackBotToken,
      signingSecret: config.slackSigningSecret,
    }),
  };

  const bot = new Chat<typeof adapters>({
    adapters,
    fallbackStreamingPlaceholderText: "Thinking...",
    state: createMemoryState(),
    userName: "phoenix-agent",
  });

  bot.onNewMention(async (thread, message) => {
    await handleAgentTurn({
      config,
      latestMessage: message,
      shouldSubscribe: true,
      thread,
    });
  });

  bot.onSubscribedMessage(async (thread, message) => {
    await handleAgentTurn({
      config,
      latestMessage: message,
      shouldSubscribe: false,
      thread,
    });
  });

  return bot;
}
