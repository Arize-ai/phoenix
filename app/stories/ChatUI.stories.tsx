import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { css } from "@emotion/react";

import { Card, Flex, View } from "@phoenix/components";
import { MessageBar } from "@phoenix/components/chat/MessageBar";
import { MessageBubble } from "@phoenix/components/chat/MessageBubble";
import { PreferencesProvider } from "@phoenix/contexts";
import { ViewerPreferences } from "@phoenix/pages/profile/ViewerPreferences";

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  isOutgoing: boolean;
}

const chatContainerCSS = css`
  display: flex;
  flex-direction: column;
  height: var(--ac-global-dimension-size-5000);
  width: 100%;
  max-width: var(--ac-global-dimension-size-6000);
  border: var(--ac-global-border-size-thin) solid
    var(--ac-global-border-color-default);
  border-radius: var(--ac-global-rounding-medium);
  overflow: hidden;
  background-color: var(--ac-global-background-color-default);
`;

const messagesContainerCSS = css`
  flex: 1;
  overflow-y: auto;
  padding: var(--ac-global-dimension-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
`;

// Use a fixed base date for consistent storybook renders
const BASE_DATE = new Date("2024-01-15T10:00:00Z");

const DEMO_MESSAGES: Message[] = [
  {
    id: "1",
    text: "Hey there! How are you?",
    timestamp: new Date(BASE_DATE.getTime() - 60000 * 25),
    isOutgoing: false,
  },
  {
    id: "2",
    text: "I'm doing great, thanks for asking! How about you?",
    timestamp: new Date(BASE_DATE.getTime() - 60000 * 24),
    isOutgoing: true,
  },
  {
    id: "3",
    text: "Pretty good! Just working on some new features.",
    timestamp: new Date(BASE_DATE.getTime() - 60000 * 23),
    isOutgoing: false,
  },
  {
    id: "4",
    text: "That sounds interesting! What kind of features are you working on?",
    timestamp: new Date(BASE_DATE.getTime() - 60000 * 22),
    isOutgoing: true,
  },
  {
    id: "5",
    text: "We're building a new chat interface with real-time updates",
    timestamp: new Date(BASE_DATE.getTime() - 60000 * 20),
    isOutgoing: false,
  },
  {
    id: "6",
    text: "It will support rich media, file sharing, and thread replies",
    timestamp: new Date(BASE_DATE.getTime() - 60000 * 19),
    isOutgoing: false,
  },
  {
    id: "7",
    text: "Wow, that's awesome! When do you think it will be ready?",
    timestamp: new Date(BASE_DATE.getTime() - 60000 * 15),
    isOutgoing: true,
  },
  {
    id: "8",
    text: "We're aiming to launch a beta version next week",
    timestamp: new Date(BASE_DATE.getTime() - 60000 * 10),
    isOutgoing: false,
  },
  {
    id: "9",
    text: "I'll make sure you get early access to try it out! 😊",
    timestamp: new Date(BASE_DATE.getTime() - 60000 * 9),
    isOutgoing: false,
  },
];

/**
 * Simulates sending a message to a server with a random delay
 */
const simulateMessageSend = async (_text: string): Promise<void> => {
  // Random delay between 1-3 seconds
  const delay = Math.random() * 2000 + 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));
};

function ChatUI() {
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async (text: string) => {
    setIsSending(true);
    try {
      await simulateMessageSend(text);
      const newMessage: Message = {
        id: Date.now().toString(),
        text,
        timestamp: new Date(),
        isOutgoing: true,
      };
      setMessages((prev) => [...prev, newMessage]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div css={chatContainerCSS}>
      <div css={messagesContainerCSS}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            text={message.text}
            timestamp={message.timestamp}
            isOutgoing={message.isOutgoing}
            userName={message.isOutgoing ? "You" : "Assistant"}
          />
        ))}
      </div>
      <MessageBar onSendMessage={handleSendMessage} isSending={isSending} />
    </div>
  );
}

const meta = {
  title: "Chat/ChatUI",
  component: ChatUI,
  decorators: [
    (Story) => (
      <PreferencesProvider>
        <Story />
      </PreferencesProvider>
    ),
  ],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A complete chat interface that demonstrates the MessageBar and MessageBubble components working together.
The interface simulates async message sending with a random delay between 1-3 seconds to showcase loading states.

Features:
- Message composition with loading states
- Message history display
- Proper message threading and timestamps
- Visual distinction between sent and received messages
- Timezone-aware timestamp formatting
`,
      },
    },
  },
} satisfies Meta<typeof ChatUI>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ChatUI />,
};

/**
 * Demonstrates how message timestamps respect timezone preferences.
 * Change the timezone in the preferences and observe how all message
 * timestamps update to reflect the selected timezone.
 */
export const WithTimezonePreferences: Story = {
  decorators: [
    (Story) => (
      <Flex direction="column" gap="size-200" width="100%">
        <ViewerPreferences />
        <Card title="Chat with Timezone-Aware Timestamps">
          <View padding="size-200">
            <Story />
          </View>
        </Card>
      </Flex>
    ),
  ],
  render: () => <ChatUI />,
};
