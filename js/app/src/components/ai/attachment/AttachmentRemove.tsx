import { Button } from "react-aria-components";

import { Icon, Icons } from "../../core/icon";
import { useAttachmentContext } from "./AttachmentContext";
import { attachmentRemoveCSS } from "./styles";
import type { AttachmentRemoveProps } from "./types";

/**
 * Remove button slot for an `<Attachment>`. Renders only when the parent
 * `<Attachment>` was given an `onRemove` handler — omit `onRemove` to render
 * a non-removable attachment.
 */
export function AttachmentRemove({
  ref,
  label = "Remove attachment",
  className,
  children,
  onPress,
  ...restProps
}: AttachmentRemoveProps) {
  const { onRemove, variant } = useAttachmentContext();

  if (!onRemove) {
    return null;
  }

  return (
    <Button
      ref={ref}
      css={attachmentRemoveCSS}
      data-variant={variant}
      className={className}
      aria-label={label}
      onPress={(e) => {
        onRemove();
        onPress?.(e);
      }}
      {...restProps}
    >
      {children ?? <Icon svg={<Icons.Close />} />}
    </Button>
  );
}
