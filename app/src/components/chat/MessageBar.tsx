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
  onSendMessage: (message: string) => void;
}

/**
 * MessageBar is a text input component for chat interfaces that includes a send button.
 * It provides a consistent way to compose and send messages.
 *
 * Features:
 * - Text input field that supports multi-line input with shift+enter
 * - Send button that is disabled when the input is empty
 * - Enter key shortcut for sending messages
 * - Automatic trimming of whitespace
 *
 * @example
 * ```tsx
 * <MessageBar
 *   onSendMessage={(message) => {
 *     sendMessageToServer(message);
 *   }}
 * />
 * ```
 */
export function MessageBar({ onSendMessage }: MessageBarProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
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
    <View padding="size-100" width="100%">
      <Flex direction="row" gap="size-100">
        <TextField
          size="M"
          value={message}
          onChange={setMessage}
          onKeyDown={handleKeyDown}
          aria-label="Message input"
        >
          <Input placeholder="Type a message" />
        </TextField>
        <Button
          size="M"
          variant="primary"
          isDisabled={!message.trim()}
          onPress={handleSend}
          aria-label="Send"
          leadingVisual={<Icon svg={<Icons.PaperPlaneOutline />} />}
        />
      </Flex>
    </View>
  );
}
