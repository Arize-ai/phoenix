import type { Ref } from "react";
import { forwardRef, useLayoutEffect, useRef } from "react";

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

  const setRefs = (node: HTMLTextAreaElement | null) => {
    internalRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref && "current" in ref) {
      (ref as React.RefObject<HTMLTextAreaElement | null>).current = node;
    }
  };

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
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(event.target.value);
  };

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
