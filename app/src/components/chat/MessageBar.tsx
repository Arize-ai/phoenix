import React, { useState } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  TextField,
  View,
} from "@phoenix/components";

interface MessageBarProps {
  /** Callback function that is called when a message is sent.
   * The function receives the trimmed message text as its argument.
   * @example (message) => console.log('New message:', message)
   */
  onSendMessage?: (message: string) => void;

  /** Whether the message is currently being sent. Controls the button's loading state.
   * @default false
   */
  isSending?: boolean;
  /**
   * The placeholder text for the message input
   * @default "Type a message"
   */
  placeholder?: string;
}

/**
 * MessageBar is a text input component for chat interfaces that includes a send button.
 * It provides a consistent way to compose and send messages.
 *
 * Features:
 * - Text input field that supports multi-line input with shift+enter
 * - Send button that is disabled when the input is empty or while sending
 * - Loading state while message is being sent (controlled via isSending prop)
 * - Enter key shortcut for sending messages
 * - Automatic trimming of whitespace
 *
 * @example
 * ```tsx
 * <MessageBar
 *   onSendMessage={(message) => {
 *     sendMessageToServer(message);
 *   }}
 *   isSending={isLoading}
 * />
 * ```
 */
export function MessageBar({
  onSendMessage,
  isSending = false,
  placeholder = "Type a message",
}: MessageBarProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage && onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <View padding="size-100" width="100%" flex="none">
      <Flex direction="row" gap="size-100">
        <TextField
          size="M"
          value={message}
          onChange={setMessage}
          onKeyDown={handleKeyDown}
          aria-label="Message input"
          isDisabled={isSending}
        >
          <Input placeholder={placeholder} />
        </TextField>
        <Button
          size="M"
          variant="primary"
          isDisabled={!message.trim() || isSending}
          onPress={handleSend}
          aria-label={isSending ? "Sending message..." : "Send"}
          leadingVisual={
            isSending ? (
              <Icon svg={<Icons.LoadingOutline />} />
            ) : (
              <Icon svg={<Icons.PaperPlaneOutline />} />
            )
          }
        />
      </Flex>
    </View>
  );
}
