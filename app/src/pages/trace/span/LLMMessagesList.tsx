import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { startTransition, useEffect, useRef, useState } from "react";

import { Skeleton } from "@phoenix/components";
import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { LLMMessage } from "./LLMMessage";

const DEFERRED_MESSAGE_PLACEHOLDER_HEIGHT_PIXELS = 320;
const DEFERRED_MESSAGE_ROOT_MARGIN_PIXELS = 0;

function DeferredLLMMessage({ message }: { message: AttributeMessage }) {
  const [hasMounted, setHasMounted] = useState(
    () => typeof IntersectionObserver === "undefined"
  );
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasMounted) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        startTransition(() => setHasMounted(true));
      },
      { rootMargin: `${DEFERRED_MESSAGE_ROOT_MARGIN_PIXELS}px 0px` }
    );
    if (placeholderRef.current) observer.observe(placeholderRef.current);
    return () => observer.disconnect();
  }, [hasMounted]);

  return (
    <div
      ref={placeholderRef}
      data-llm-message-state={hasMounted ? "mounted" : "pending"}
      css={css`
        min-height: ${hasMounted
          ? 0
          : DEFERRED_MESSAGE_PLACEHOLDER_HEIGHT_PIXELS}px;
      `}
    >
      {hasMounted ? (
        <LLMMessage message={message} />
      ) : (
        <Skeleton
          animation={false}
          height={DEFERRED_MESSAGE_PLACEHOLDER_HEIGHT_PIXELS}
        />
      )}
    </div>
  );
}

/**
 * A list of LLM messages (input or output).
 */
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
  return (
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-100);
        padding: var(--global-dimension-size-200);
      `}
    >
      {leadingItems?.map((item, idx) => (
        <li key={`leading-${idx}`}>{item}</li>
      ))}
      {messages.map((message, idx) => {
        return (
          <li key={idx}>
            <DeferredLLMMessage message={message} />
          </li>
        );
      })}
    </ul>
  );
}
