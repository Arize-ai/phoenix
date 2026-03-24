import type { Ref } from "react";
import { forwardRef, useCallback, useMemo, useState } from "react";

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

function PromptInputRoot(
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

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit?.(trimmed);
      setValue("");
    }
  }, [value, onSubmit]);

  const contextValue = useMemo(
    () => ({
      status,
      isDisabled,
      onSubmit: handleSubmit,
      value,
      setValue,
    }),
    [status, isDisabled, handleSubmit, value]
  );

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

const _PromptInput = forwardRef(PromptInputRoot);
_PromptInput.displayName = "PromptInput";
export { _PromptInput as PromptInput };

function PromptInputBodyRoot(
  { children, ...restProps }: PromptInputBodyProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputBodyCSS} {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputBody = forwardRef(PromptInputBodyRoot);
_PromptInputBody.displayName = "PromptInputBody";
export { _PromptInputBody as PromptInputBody };

function PromptInputFooterRoot(
  { children, ...restProps }: PromptInputFooterProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputFooterCSS} {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputFooter = forwardRef(PromptInputFooterRoot);
_PromptInputFooter.displayName = "PromptInputFooter";
export { _PromptInputFooter as PromptInputFooter };

function PromptInputToolsRoot(
  { children, ...restProps }: PromptInputToolsProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputToolsCSS} role="toolbar" {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputTools = forwardRef(PromptInputToolsRoot);
_PromptInputTools.displayName = "PromptInputTools";
export { _PromptInputTools as PromptInputTools };

function PromptInputActionsRoot(
  { children, ...restProps }: PromptInputActionsProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputActionsCSS} {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputActions = forwardRef(PromptInputActionsRoot);
_PromptInputActions.displayName = "PromptInputActions";
export { _PromptInputActions as PromptInputActions };
