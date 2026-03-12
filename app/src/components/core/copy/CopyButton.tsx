import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import type { ReactNode, RefObject } from "react";
import { useCallback, useState } from "react";

import type { ButtonProps } from "../button";
import { Button } from "../button";
import { Icon, Icons } from "../icon";
import { Tooltip, TooltipTrigger } from "../tooltip";

const SHOW_COPIED_TIMEOUT_MS = 2000;

export interface CopyButtonProps {
  /**
   * The text to copy to the clipboard.
   */
  text: string | RefObject<string | null>;
  /**
   * The size of the button.
   * @default "S"
   */
  size?: ButtonProps["size"];
  /**
   * Optional label text. When omitted the button renders as icon-only.
   * @default undefined
   * @example "Copy"
   * @example "Copy link"
   */
  children?: ReactNode;
}

const copyButtonCSS = css`
  flex: none;
  box-sizing: content-box;
`;

/**
 * A button that copies text to the clipboard and shows a brief checkmark
 * confirmation. Renders as icon-only when no children are provided, or as a
 * labeled button when children (e.g. "Copy" or "Copy link") are given.
 */
export function CopyButton({ text, size = "S", children }: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const onPress = useCallback(() => {
    const value = typeof text === "string" ? text : text.current || "";
    copy(value);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, SHOW_COPIED_TIMEOUT_MS);
  }, [text]);

  const icon = <Icon svg={isCopied ? <Icons.Checkmark /> : <Icons.Copy />} />;

  return (
    <div className="copy-button" css={copyButtonCSS}>
      <TooltipTrigger delay={0}>
        <Button
          size={size}
          leadingVisual={icon}
          onPress={onPress}
          aria-label={children ? undefined : "Copy"}
        >
          {children ? (isCopied ? "Copied" : children) : undefined}
        </Button>
        <Tooltip offset={5}>{isCopied ? "Copied" : "Copy"}</Tooltip>
      </TooltipTrigger>
    </div>
  );
}
