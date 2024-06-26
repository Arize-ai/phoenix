import React, { useCallback, useState } from "react";
import copy from "copy-to-clipboard";

import {
  Button,
  ButtonProps,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@arizeai/components";

const SHOW_COPIED_TIMEOUT_MS = 2000;

/**
 * An Icon button that copies the given text to the clipboard when clicked.
 */
export function CopyToClipboardButton({
  text,
  size = "compact",
  disabled = false,
}: {
  text: string;

  size?: ButtonProps["size"];
  disabled?: boolean;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const onClick = useCallback(() => {
    copy(text);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, SHOW_COPIED_TIMEOUT_MS);
  }, [text]);
  return (
    <div className="copy-to-clipboard-button">
      <TooltipTrigger delay={0} offset={5}>
        <Button
          variant="default"
          disabled={disabled}
          icon={
            <Icon
              svg={isCopied ? <Icons.Checkmark /> : <Icons.ClipboardCopy />}
            />
          }
          size={size}
          onClick={onClick}
        />
        <Tooltip>Copy</Tooltip>
      </TooltipTrigger>
    </div>
  );
}
