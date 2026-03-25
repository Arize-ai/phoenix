import { useLayoutEffect, useRef } from "react";

import { usePromptInputContext } from "./PromptInputContext";
import { promptInputTextareaCSS } from "./styles";
import type { PromptInputTextareaProps } from "./types";

/**
 * Auto-resizing textarea that grows with its content.
 *
 * - **Enter** submits the message via `context.onSubmit`.
 * - **Shift+Enter** inserts a newline.
 * - Automatically resizes up to `maxRows`, then scrolls.
 *
 * By default reads value/setValue from the parent `PromptInput` context.
 * Pass `value` and `onChange` props to use controlled state instead.
 *
 * @example
 * ```tsx
 * <PromptInputBody>
 *   <PromptInputTextarea placeholder="Ask a question..." maxRows={10} />
 * </PromptInputBody>
 * ```
 */
export function PromptInputTextarea({
  ref,
  placeholder = "Send a message...",
  value: controlledValue,
  onChange: controlledOnChange,
  maxRows,
  "aria-label": ariaLabel = "Message input",
  className,
}: PromptInputTextareaProps) {
  const context = usePromptInputContext();
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  // Use controlled props when provided, otherwise fall back to context state.
  // This allows the textarea to work as an uncontrolled child of PromptInput
  // (the common case) or as a fully controlled component when the consumer
  // needs to own the value externally.
  const textareaValue =
    controlledValue !== undefined ? controlledValue : context.value;
  const handleChange =
    controlledOnChange !== undefined ? controlledOnChange : context.setValue;

  // Merge the forwarded ref with our internal ref so we can measure the
  // element for auto-resize while still exposing the ref to the consumer.
  const mergeRefs = (node: HTMLTextAreaElement | null) => {
    internalRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref && "current" in ref) {
      (ref as React.RefObject<HTMLTextAreaElement | null>).current = node;
    }
  };

  // Auto-resize: reset height to "auto" to get the natural scrollHeight,
  // then clamp to maxRows if specified. Runs synchronously before paint
  // via useLayoutEffect to avoid a visible flicker.
  useLayoutEffect(() => {
    const textarea = internalRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    let newHeight = textarea.scrollHeight;

    if (maxRows) {
      const lineHeight = parseInt(
        getComputedStyle(textarea).lineHeight || "20",
        10
      );
      const maxHeight = lineHeight * maxRows;
      newHeight = Math.min(newHeight, maxHeight);
    }

    textarea.style.height = `${newHeight}px`;
  }, [textareaValue, maxRows]);

  const { onSubmit } = context;

  // Enter submits the message; Shift+Enter inserts a newline (default
  // browser behavior, so we only need to intercept the bare Enter case).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  // Forward the raw string value to the change handler (context.setValue or
  // the controlled onChange prop), unwrapping the native ChangeEvent.
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(event.target.value);
  };

  return (
    <textarea
      ref={mergeRefs}
      css={promptInputTextareaCSS}
      className={className}
      value={textareaValue}
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={context.isDisabled}
      aria-label={ariaLabel}
      rows={1}
    />
  );
}
