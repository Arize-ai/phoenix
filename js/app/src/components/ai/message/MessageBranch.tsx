import { Children, isValidElement, useState } from "react";

import { MessageBranchContent } from "./MessageBranchContent";
import { MessageBranchContext } from "./MessageBranchContext";
import type { MessageBranchProps } from "./types";

/**
 * State provider for branch (version) navigation. Manages which branch
 * is active and exposes navigation controls via {@link MessageBranchContext}.
 *
 * Wrap a {@link MessageBranchContent} and {@link MessageBranchSelector}
 * inside this component to enable version switching.
 *
 * @example
 * ```tsx
 * <MessageBranch defaultBranch={0}>
 *   <MessageBranchContent>
 *     <MessageContent key="v1">...</MessageContent>
 *     <MessageContent key="v2">...</MessageContent>
 *   </MessageBranchContent>
 *   <MessageToolbar>
 *     <MessageBranchSelector>
 *       <MessageBranchPrevious />
 *       <MessageBranchPage />
 *       <MessageBranchNext />
 *     </MessageBranchSelector>
 *   </MessageToolbar>
 * </MessageBranch>
 * ```
 */
export function MessageBranch({
  children,
  defaultBranch = 0,
}: MessageBranchProps) {
  const [activeBranch, setActiveBranch] = useState(defaultBranch);
  const branchContent = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === MessageBranchContent
  );
  const branchCount = isValidElement<MessageBranchProps>(branchContent)
    ? Children.count(branchContent.props.children)
    : 0;

  const safeSetActiveBranch = (index: number) => {
    setActiveBranch(Math.max(0, Math.min(index, branchCount - 1)));
  };

  return (
    <MessageBranchContext.Provider
      value={{
        activeBranch,
        branchCount,
        setActiveBranch: safeSetActiveBranch,
      }}
    >
      {children}
    </MessageBranchContext.Provider>
  );
}
