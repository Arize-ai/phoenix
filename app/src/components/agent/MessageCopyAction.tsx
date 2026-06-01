import copy from "copy-to-clipboard";
import { useState } from "react";

import { Icon, Icons } from "@phoenix/components";
import { MessageAction } from "@phoenix/components/ai/message";

const SHOW_COPIED_TIMEOUT_MS = 2000;

/**
 * Copy-to-clipboard control for a chat message, rendered as a bare
 * {@link MessageAction} so it slots into an existing `MessageActions` row.
 *
 * Mirrors the app-wide copy affordance: the duplicate glyph swaps to a success
 * checkmark briefly after copying. Renders nothing when there is no text to
 * copy.
 */
export function MessageCopyAction({ text }: { text: string }) {
  const [isCopied, setIsCopied] = useState(false);

  if (text.trim().length === 0) {
    return null;
  }

  const handleCopy = () => {
    copy(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), SHOW_COPIED_TIMEOUT_MS);
  };

  return (
    <MessageAction
      label="Copy"
      tooltip={isCopied ? "Copied" : "Copy message"}
      onPress={handleCopy}
    >
      <Icon
        svg={isCopied ? <Icons.Checkmark /> : <Icons.DuplicateOutline />}
        color={isCopied ? "success" : "inherit"}
      />
    </MessageAction>
  );
}
