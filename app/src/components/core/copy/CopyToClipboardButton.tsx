import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import type { RefObject } from "react";
import { useCallback, useState } from "react";

import type { ButtonProps } from "../button";
import { Button } from "../button";
import { Icon } from "../icon";
import { Tooltip, TooltipTrigger } from "../tooltip";

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
  text: string | RefObject<string | null>;
};

const copyToClipboardButtonCSS = css`
  flex: none;
  box-sizing: content-box;
`;

/**
 * An Icon button that copies the given text to the clipboard when clicked.
 */
export function CopyToClipboardButton(props: CopyToClipboardButtonProps) {
  const { text, size = "S", ...otherProps } = props;
  const [isCopied, setIsCopied] = useState(false);

  const onPress = useCallback(() => {
    const textToCopy = typeof text === "string" ? text : text.current || "";
    copy(textToCopy);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, SHOW_COPIED_TIMEOUT_MS);
  }, [text]);
  return (
    <div className="copy-to-clipboard-button" css={copyToClipboardButtonCSS}>
      <TooltipTrigger>
        <Button
          size={size}
          leadingVisual={
            <Icon
              color={isCopied ? "success" : "inherit"}
              svgKey={isCopied ? "Checkmark" : "DuplicateOutline"}
            />
          }
          onPress={onPress}
          {...otherProps}
          className="copy-button"
        />
        <Tooltip offset={1}>Copy</Tooltip>
      </TooltipTrigger>
    </div>
  );
}
