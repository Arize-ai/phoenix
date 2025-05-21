import { RefObject, useCallback, useState } from "react";
import copy from "copy-to-clipboard";
import { css } from "@emotion/react";

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
  text: string | RefObject<string>;
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
      <TooltipTrigger delay={0} offset={5}>
        <Button
          size={size}
          leadingVisual={
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
