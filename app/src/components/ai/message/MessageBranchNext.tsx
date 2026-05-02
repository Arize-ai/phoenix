import { Button } from "react-aria-components";

import { Icon, Icons } from "../../core/icon";
import { useMessageBranchContext } from "./MessageBranchContext";
import { messageActionCSS } from "./styles";
import type { MessageBranchNextProps } from "./types";

/**
 * Button that navigates to the next branch. Disables itself when the
 * last branch is active. Must be used within a {@link MessageBranch}.
 */
export function MessageBranchNext({
  ref,
  ...restProps
}: MessageBranchNextProps) {
  const { activeBranch, branchCount, setActiveBranch } =
    useMessageBranchContext();

  return (
    <Button
      ref={ref}
      css={messageActionCSS}
      aria-label="Next version"
      isDisabled={activeBranch >= branchCount - 1}
      onPress={() => setActiveBranch(activeBranch + 1)}
      {...restProps}
    >
      <Icon svg={<Icons.ArrowIosForwardOutline />} />
    </Button>
  );
}
