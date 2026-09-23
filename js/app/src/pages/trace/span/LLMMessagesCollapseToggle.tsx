import {
  Icon,
  IconButton,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

import { useLLMMessagesCollapse } from "./LLMMessagesCollapseContext";

/**
 * Expands or collapses every message in an LLM message list at once.
 *
 * The list arrives mostly collapsed, so the control offers the expand until
 * every message is open, and only then offers the way back.
 *
 * Renders nothing for a list of one, where the message is already open and
 * there is nothing for the control to do.
 */
export function LLMMessagesCollapseToggle({
  /**
   * Which side of the span the messages are, which names the control. An LLM
   * span can show this toggle twice, and two buttons reading "expand all
   * messages" would leave a screen reader with no way to tell the prompt from
   * the completion.
   */
  scope,
}: {
  scope: "input" | "output";
}) {
  const { messageCount, areAllMessagesExpanded, setAllMessagesOpen } =
    useLLMMessagesCollapse();
  if (messageCount < 2) {
    return null;
  }
  const label = `${areAllMessagesExpanded ? "Collapse" : "Expand"} all ${scope} messages`;
  return (
    <TooltipTrigger>
      <IconButton
        size="S"
        aria-label={label}
        onPress={() => setAllMessagesOpen(!areAllMessagesExpanded)}
      >
        <Icon
          svg={
            areAllMessagesExpanded ? <Icons.RowCollapse /> : <Icons.RowExpand />
          }
        />
      </IconButton>
      <Tooltip offset={-5}>{label}</Tooltip>
    </TooltipTrigger>
  );
}
