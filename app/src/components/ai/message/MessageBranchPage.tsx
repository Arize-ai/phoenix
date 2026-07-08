import { useMessageBranchContext } from "./MessageBranchContext";
import { messageBranchPageCSS } from "./styles";

/**
 * Displays the current branch position as "{active} of {total}" text.
 * Must be used within a {@link MessageBranch}.
 */
export function MessageBranchPage() {
  const { activeBranch, branchCount } = useMessageBranchContext();

  return (
    <span css={messageBranchPageCSS}>
      {activeBranch + 1} of {branchCount}
    </span>
  );
}
