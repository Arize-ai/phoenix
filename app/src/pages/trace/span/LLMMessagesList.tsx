import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { LLMMessage } from "./LLMMessage";
import { useLLMMessagesCollapse } from "./LLMMessagesCollapseContext";
import { useLLMMessagesSearch } from "./LLMMessagesSearchContext";
import { useHighlightMatchedText } from "./useHighlightMatchedText";

/**
 * A list of LLM messages (input or output).
 */
const listCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-200);

  // A match is marked on its own row rather than on the card, so the colour the
  // card already carries for its role stays readable
  .llm-message--match > .card {
    outline: var(--global-border-size-thin) solid
      var(--global-color-primary-700);
    outline-offset: var(--global-dimension-size-10);
  }
  // Colour, not just width: a 1px difference left the two states near enough
  // to identical that a reader had to compare cards to tell where they were.
  .llm-message--active-match > .card {
    outline-width: var(--global-border-size-thick);
    outline-color: var(--field-editing-background);
  }

  // Painted over the matched text by the custom highlight API rather than
  // wrapped around it, so the markdown renderer's own output, syntax colours
  // included, is left alone.
  //
  // Mixed from the blue token rather than its \`-rgb\` companion, which only the
  // dark theme defines: an undefined var makes the whole declaration invalid,
  // so an rgba() built on it paints nothing at all in light mode.
  ::highlight(llm-message-match) {
    background-color: color-mix(
      in srgb,
      var(--global-color-blue-500) 40%,
      transparent
    );
    color: inherit;
  }
  // The one the reader is standing on. --field-editing-background is the
  // token Phoenix already uses for "white text on brand blue", and it exists
  // precisely because the blue ramp inverts between themes: blue-500 is a dark
  // blue in dark mode and a pale tint in light mode, so pinning one ramp value
  // gives white-on-pale-blue at 1.9:1 in light mode. Borrowing the token keeps
  // both themes above the 4.5:1 AA threshold.
  ::highlight(llm-message-match-active) {
    background-color: var(--field-editing-background);
    color: var(--field-editing-foreground);
  }
`;

/**
 * Scrolls the message the reader has stepped to into view.
 *
 * It watches the count of moves rather than which message is current, so asking
 * for the next match on a list of one still brings you back to it. Nothing here
 * fires while the reader is typing, since typing sets no current match.
 */
function useScrollActiveMatchIntoView(isActive: boolean) {
  const ref = useRef<HTMLLIElement>(null);
  const { navigationCount } = useLLMMessagesSearch();
  useEffect(() => {
    if (!isActive || navigationCount === 0) {
      return;
    }
    // `nearest` so a match already on screen is left where it is instead of
    // being yanked to the top of the pane
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [isActive, navigationCount]);
  return ref;
}

function LLMMessageListItem({
  message,
  index,
}: {
  message: AttributeMessage;
  index: number;
}) {
  const { isMessageOpen, setMessageOpen } = useLLMMessagesCollapse();
  const { isMatch, isActiveMatch } = useLLMMessagesSearch();
  const isActive = isActiveMatch(index);
  const ref = useScrollActiveMatchIntoView(isActive);
  return (
    <li
      ref={ref}
      data-message-index={index}
      className={[
        isMatch(index) ? "llm-message--match" : "",
        isActive ? "llm-message--active-match" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <LLMMessage
        message={message}
        isOpen={isMessageOpen(index)}
        onOpenChange={(isOpen) => setMessageOpen(index, isOpen)}
      />
    </li>
  );
}

export function LLMMessagesList({
  messages,
  leadingItems,
}: {
  messages: AttributeMessage[];
  /**
   * Extra content rendered as list items above the messages (e.g. collapsed
   * prompt template / invocation params cards on the input side).
   */
  leadingItems?: ReactNode[];
}) {
  const listRef = useRef<HTMLUListElement>(null);
  useHighlightMatchedText(listRef);
  return (
    <ul css={listCSS} ref={listRef}>
      {leadingItems?.map((item, idx) => (
        <li key={`leading-${idx}`}>{item}</li>
      ))}
      {messages.map((message, idx) => (
        <LLMMessageListItem key={idx} message={message} index={idx} />
      ))}
    </ul>
  );
}
