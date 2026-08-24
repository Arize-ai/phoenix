import { css } from "@emotion/react";
import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";

import {
  Icon,
  IconButton,
  Icons,
  SearchButton,
  Text,
  Tooltip,
  TooltipTrigger,
  VisuallyHidden,
} from "@phoenix/components";

import { useLLMMessagesSearch } from "./LLMMessagesSearchContext";
import { describeMessage } from "./utils";

const searchCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-50);

  // Holds its width across "7 matches", "2 of 7" and "No matches" so the
  // buttons beside it do not shuffle sideways as the reader types
  .llm-messages-search__count {
    min-width: var(--global-dimension-size-1000);
    text-align: end;
    white-space: nowrap;
  }
`;

/**
 * Pins the card header while a search is running, so the control that moves the
 * reader between matches is not the first thing the scroll takes away.
 *
 * An element cannot stick past a clipping ancestor, so the two that clip are
 * lifted for the duration. The z-index clears the message rows below, whose
 * Text/Markdown toggles would otherwise paint through on a DOM-order tie.
 */
export const stickySearchHeaderCSS = css`
  &[data-search-active="true"] {
    // The card clips too, and for the same reason has to be lifted. Its
    // companion rule, on the view above it, is in SpanDetails' scroll wrapper.
    & > .card {
      overflow: visible;
    }

    & > .card > header {
      position: sticky;
      top: 0;
      z-index: 2;
      background-color: var(--global-card-header-background-color);
    }
  }
`;

/**
 * Announces `message`, speaking it again whenever `nonce` changes even if the
 * text has not.
 *
 * Emptied and refilled a frame later, because a region set to the text it
 * already holds is not spoken again. Stays mounted: a screen reader watches a
 * region it already knows about.
 */
function useLiveAnnouncement(message: string, nonce: number) {
  const regionRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const region = regionRef.current;
    const write = (text: string) => {
      if (region !== null) {
        region.textContent = text;
      }
    };
    write("");
    // A frame apart so the empty state lands as its own change. Written back to
    // back, the region would go from the message to the same message again.
    const frame = requestAnimationFrame(() => write(message));
    return () => cancelAnimationFrame(frame);
  }, [message, nonce]);
  return regionRef;
}

/**
 * Searches a list of LLM messages, reporting how many match and stepping
 * between them.
 *
 * Typing only ever changes what is marked and counted. Moving the reader is a
 * separate act they ask for, with Enter or the arrows, because a page that
 * scrolls itself out from under someone mid-word takes away the place they were
 * reading.
 */
export function LLMMessagesSearch({
  /**
   * Which side of the span the messages are, which names the control. An LLM
   * span shows this twice, and two fields both labelled "search messages" would
   * leave a screen reader with no way to tell the prompt from the completion.
   */
  scope,
}: {
  scope: "input" | "output";
}) {
  const {
    query,
    setQuery,
    matchIndices,
    activeMatchOrdinal,
    goToNextMatch,
    goToPreviousMatch,
    spanId,
    navigationCount,
    activeMessage,
  } = useLLMMessagesSearch();

  const matchCount = matchIndices.length;
  const isSearching = query.trim().length > 0;

  // Before the reader has moved there is a total but no position, so the
  // readout offers the total rather than inventing a place they have not been
  const countLabel = !isSearching
    ? ""
    : matchCount === 0
      ? "No matches"
      : activeMatchOrdinal < 0
        ? `${matchCount} ${matchCount === 1 ? "match" : "matches"}`
        : `${activeMatchOrdinal + 1} of ${matchCount}`;

  // The spoken readout names the message as well as the position. "2 of 7" is
  // enough for a sighted reader, who can see the scroll and the highlight. A
  // screen reader gets the number and nothing else.
  const spokenLabel =
    activeMessage == null
      ? countLabel
      : `${countLabel}, ${describeMessage(activeMessage)}`;
  const announcementRef = useLiveAnnouncement(spokenLabel, navigationCount);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") {
      return;
    }
    // The field sits in a toolbar inside a card, so without this the Enter would
    // carry on up to whatever else is listening
    event.preventDefault();
    if (event.shiftKey) {
      goToPreviousMatch();
    } else {
      goToNextMatch();
    }
  };

  return (
    <div css={searchCSS}>
      {/*
        Rests as a magnifier and opens on focus, the same control the
        attributes tab uses, so the two searches in a span behave alike. It
        stays open while it holds text, which is also exactly when the count
        and the arrows below have anything to say.
      */}
      <SearchButton
        // The field is uncontrolled, so it keeps whatever was typed into it
        // until it is replaced. Moving to another span clears the query, and
        // without a fresh field the box would go on showing a query that no
        // longer matches anything.
        key={spanId}
        aria-label={`Search ${scope} messages`}
        placeholder="Search messages"
        defaultValue={query}
        onChange={setQuery}
        onKeyDown={onKeyDown}
      />
      {/*
        The count is drawn, not spoken: `mark`-style emphasis and a number in a
        corner reach a sighted reader and nobody else. WCAG 2.2 4.1.3 covers
        exactly this kind of "18 results returned" message, so it is repeated
        here as a status a screen reader announces without the reader having to
        go looking for it.

        Mounted whether or not a search is running, and left empty until there
        is something to say: a live region has to be watched before it changes,
        and one that appears already holding its message can go unspoken.
      */}
      <VisuallyHidden>
        <span ref={announcementRef} role="status" aria-atomic="true" />
      </VisuallyHidden>
      {isSearching ? (
        <>
          <Text
            className="llm-messages-search__count"
            size="XS"
            color="text-700"
            aria-hidden
          >
            {countLabel}
          </Text>
          <TooltipTrigger>
            <IconButton
              size="S"
              aria-label={`Previous match in ${scope} messages`}
              isDisabled={matchCount === 0}
              onPress={goToPreviousMatch}
            >
              <Icon svg={<Icons.ChevronUp />} />
            </IconButton>
            <Tooltip offset={-5}>Previous match (Shift+Enter)</Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <IconButton
              size="S"
              aria-label={`Next match in ${scope} messages`}
              isDisabled={matchCount === 0}
              onPress={goToNextMatch}
            >
              <Icon svg={<Icons.ChevronDown />} />
            </IconButton>
            <Tooltip offset={-5}>Next match (Enter)</Tooltip>
          </TooltipTrigger>
        </>
      ) : null}
    </div>
  );
}
