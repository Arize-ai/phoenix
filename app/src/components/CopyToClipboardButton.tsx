import React, { useCallback, useState } from "react";

import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
  useNotification,
} from "@arizeai/components";

const SHOW_COPIED_TIMEOUT_MS = 2000;

/**
 * An Icon button that copies the given text to the clipboard when clicked.
 */
export function CopyToClipboardButton({ text }: { text: string }) {
  const [notify, holder] = useNotification({ style: { zIndex: 1000 } });
  const [isCopied, setIsCopied] = useState(false);

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, SHOW_COPIED_TIMEOUT_MS);
    } catch (e) {
      notify({
        title: "Failed to copy to clipboard",
        message: e instanceof Error ? e.message : String(e),
        variant: "danger",
      });
    }
  }, [notify, text]);
  return (
    <div className="copy-to-clipboard-button">
      <TooltipTrigger delay={0} offset={5}>
        <Button
          variant="default"
          icon={
            <Icon
              svg={isCopied ? <Icons.Checkmark /> : <Icons.ClipboardCopy />}
            />
          }
          size="compact"
          onClick={onClick}
        />
        <Tooltip>Copy</Tooltip>
      </TooltipTrigger>
      {holder}
    </div>
  );
}
