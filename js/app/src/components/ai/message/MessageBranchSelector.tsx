import { useMessageBranchContext } from "./MessageBranchContext";
import { messageBranchSelectorCSS } from "./styles";
import type { MessageBranchSelectorProps } from "./types";

/**
 * Container for branch navigation controls. Automatically hides itself
 * when there is only one branch (or none). Renders with `role="group"`
 * and an accessible label.
 *
 * Must be used within a {@link MessageBranch}.
 *
 * @example
 * ```tsx
 * <MessageBranchSelector>
 *   <MessageBranchPrevious />
 *   <MessageBranchPage />
 *   <MessageBranchNext />
 * </MessageBranchSelector>
 * ```
 */
export function MessageBranchSelector({
  children,
  ref,
  ...restProps
}: MessageBranchSelectorProps) {
  const { branchCount } = useMessageBranchContext();

  if (branchCount <= 1) {
    return null;
  }

  return (
    <div
      ref={ref}
      css={messageBranchSelectorCSS}
      role="group"
      aria-label="Version navigation"
      {...restProps}
    >
      {children}
    </div>
  );
}
