import { useRef, useState } from "react";

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
  const branchCountRef = useRef(0);

  const safeSetActiveBranch = (index: number) => {
    setActiveBranch(Math.max(0, Math.min(index, branchCountRef.current - 1)));
  };

  return (
    <MessageBranchContext.Provider
      value={{
        activeBranch,
        branchCount: branchCountRef.current,
        setActiveBranch: safeSetActiveBranch,
        setBranchCount: (count: number) => {
          branchCountRef.current = count;
        },
      }}
    >
      {children}
    </MessageBranchContext.Provider>
  );
}
