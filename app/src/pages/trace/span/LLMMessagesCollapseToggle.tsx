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
 * Renders nothing for a list of one, where the message is already open and
 * there is nothing for the control to do.
 */
export function LLMMessagesCollapseToggle() {
  const { messageCount, areAllMessagesCollapsed, setAllMessagesOpen } =
    useLLMMessagesCollapse();
  if (messageCount < 2) {
    return null;
  }
  const label = areAllMessagesCollapsed
    ? "Expand all messages"
    : "Collapse all messages";
  return (
    <TooltipTrigger>
      <IconButton
        size="S"
        aria-label={label}
        onPress={() => setAllMessagesOpen(areAllMessagesCollapsed)}
      >
        <Icon
          svg={
            areAllMessagesCollapsed ? (
              <Icons.RowExpand />
            ) : (
              <Icons.RowCollapse />
            )
          }
        />
      </IconButton>
      <Tooltip offset={-5}>{label}</Tooltip>
    </TooltipTrigger>
  );
}
