import { Children } from "react";

import { useMessageBranchContext } from "./MessageBranchContext";
import type { MessageBranchContentProps } from "./types";

/**
 * Renders only the currently active branch child. Each direct child
 * represents one branch version — pass them as an array. The component
 * registers the total branch count with the parent {@link MessageBranch}
 * so navigation controls stay in sync.
 *
 * Must be used within a {@link MessageBranch}.
 *
 * @example
 * ```tsx
 * <MessageBranchContent>
 *   <MessageContent key="v1"><MessageResponse>{v1}</MessageResponse></MessageContent>
 *   <MessageContent key="v2"><MessageResponse>{v2}</MessageResponse></MessageContent>
 * </MessageBranchContent>
 * ```
 */
export function MessageBranchContent({ children }: MessageBranchContentProps) {
  const { activeBranch, setBranchCount } = useMessageBranchContext();
  const childArray = Children.toArray(children);

  // Write to the ref synchronously during render so sibling components
  // (e.g. MessageBranchPage) read the correct count on the same pass.
  setBranchCount(childArray.length);

  return <>{childArray[activeBranch] ?? null}</>;
}
