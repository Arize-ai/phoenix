import { Button } from "react-aria-components";

import { Icon, Icons } from "../../core/icon";
import { useMessageBranchContext } from "./MessageBranchContext";
import { messageActionCSS } from "./styles";
import type { MessageBranchPreviousProps } from "./types";

/**
 * Button that navigates to the previous branch. Disables itself when the
 * first branch is active. Must be used within a {@link MessageBranch}.
 */
export function MessageBranchPrevious({
  ref,
  ...restProps
}: MessageBranchPreviousProps) {
  const { activeBranch, setActiveBranch } = useMessageBranchContext();

  return (
    <Button
      ref={ref}
      css={messageActionCSS}
      aria-label="Previous version"
      isDisabled={activeBranch <= 0}
      onPress={() => setActiveBranch(activeBranch - 1)}
      {...restProps}
    >
      <Icon svg={<Icons.ArrowIosBackOutline />} />
    </Button>
  );
}
