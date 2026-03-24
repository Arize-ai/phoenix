import type { Ref } from "react";
import { forwardRef, useCallback, useLayoutEffect, useRef } from "react";

import { usePromptInputContext } from "./PromptInputContext";
import { promptInputTextareaCSS } from "./styles";
import type { PromptInputTextareaProps } from "./types";

function PromptInputTextareaRoot(
  {
    placeholder = "Send a message...",
    value: controlledValue,
    onChange: controlledOnChange,
    maxRows,
    "aria-label": ariaLabel = "Message input",
    className,
  }: PromptInputTextareaProps,
  ref: Ref<HTMLTextAreaElement>
) {
  const context = usePromptInputContext();
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  const textareaValue =
    controlledValue !== undefined ? controlledValue : context.value;
  const handleChange =
    controlledOnChange !== undefined ? controlledOnChange : context.setValue;

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
          node;
      }
    },
    [ref]
  );

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

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        context.onSubmit();
      }
    },
    [context]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleChange(event.target.value);
    },
    [handleChange]
  );

  return (
    <textarea
      ref={setRefs}
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

const _PromptInputTextarea = forwardRef(PromptInputTextareaRoot);
_PromptInputTextarea.displayName = "PromptInputTextarea";
export { _PromptInputTextarea as PromptInputTextarea };
