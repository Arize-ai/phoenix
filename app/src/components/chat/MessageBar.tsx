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
  onSendMessage: (message: string) => void;
}

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
