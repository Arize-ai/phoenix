import React, { useCallback, useState } from "react";
import copy from "copy-to-clipboard";

import { Tooltip, TooltipTrigger } from "@arizeai/components";

import { Button, ButtonProps, Icon, Icons } from "@phoenix/components";

const SHOW_COPIED_TIMEOUT_MS = 2000;

export type CopyToClipboardButtonProps = Omit<
  ButtonProps,
  "icon" | "onPress" | "size"
> & {
  /**
   * The size of the button
   * @default S
   */
  size?: ButtonProps["size"];
  /**
   * The text to copy to the clipboard
   */
  text: string;
};

/**
 * An Icon button that copies the given text to the clipboard when clicked.
 */
export function CopyToClipboardButton(props: CopyToClipboardButtonProps) {
  const { text, size = "S", ...otherProps } = props;
  const [isCopied, setIsCopied] = useState(false);

  const onPress = useCallback(() => {
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
          size={size}
          icon={
            <Icon
              svg={isCopied ? <Icons.Checkmark /> : <Icons.ClipboardCopy />}
            />
          }
          onPress={onPress}
          {...otherProps}
        />
        <Tooltip>Copy</Tooltip>
      </TooltipTrigger>
    </div>
  );
}
