import type { Ref } from "react";
import { forwardRef, useRef, useState } from "react";

import { PromptInputContext } from "./PromptInputContext";

import {
  promptInputActionsCSS,
  promptInputBodyCSS,
  promptInputContainerCSS,
  promptInputFooterCSS,
  promptInputToolsCSS,
} from "./styles";
import type {
  PromptInputActionsProps,
  PromptInputBodyProps,
  PromptInputFooterProps,
  PromptInputProps,
  PromptInputToolsProps,
} from "./types";

function PromptInput(
  {
    children,
    onSubmit,
    status = "ready",
    isDisabled = false,
    ...restProps
  }: PromptInputProps,
  ref: Ref<HTMLDivElement>
) {
  const [value, setValue] = useState("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleSubmit = () => {
    const trimmed = valueRef.current.trim();
    if (trimmed) {
      onSubmit?.(trimmed);
      setValue("");
    }
  };

  const contextValue = {
    status,
    isDisabled,
    onSubmit: handleSubmit,
    value,
    setValue,
  };

  return (
    <PromptInputContext.Provider value={contextValue}>
      <div
        ref={ref}
        css={promptInputContainerCSS}
        data-status={status}
        {...restProps}
      >
        {children}
      </div>
    </PromptInputContext.Provider>
  );
}

const _PromptInput = forwardRef(PromptInput);
_PromptInput.displayName = "PromptInput";
export { _PromptInput as PromptInput };

function PromptInputBody(
  { children, ...restProps }: PromptInputBodyProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputBodyCSS} {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputBody = forwardRef(PromptInputBody);
_PromptInputBody.displayName = "PromptInputBody";
export { _PromptInputBody as PromptInputBody };

function PromptInputFooter(
  { children, ...restProps }: PromptInputFooterProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputFooterCSS} {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputFooter = forwardRef(PromptInputFooter);
_PromptInputFooter.displayName = "PromptInputFooter";
export { _PromptInputFooter as PromptInputFooter };

function PromptInputTools(
  { children, ...restProps }: PromptInputToolsProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputToolsCSS} role="toolbar" {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputTools = forwardRef(PromptInputTools);
_PromptInputTools.displayName = "PromptInputTools";
export { _PromptInputTools as PromptInputTools };

function PromptInputActions(
  { children, ...restProps }: PromptInputActionsProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputActionsCSS} {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputActions = forwardRef(PromptInputActions);
_PromptInputActions.displayName = "PromptInputActions";
export { _PromptInputActions as PromptInputActions };
