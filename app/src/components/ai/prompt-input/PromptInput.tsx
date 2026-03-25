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

/**
 * Root container for the prompt input compound component.
 *
 * Manages internal text state and provides context to all descendants.
 * Compose with `PromptInputBody`, `PromptInputFooter`, and other
 * sub-components to build a complete chat input.
 *
 * @example
 * ```tsx
 * <PromptInput onSubmit={(text) => sendMessage({ text })} status={status}>
 *   <PromptInputBody>
 *     <PromptInputTextarea placeholder="Send a message..." />
 *   </PromptInputBody>
 *   <PromptInputFooter>
 *     <PromptInputTools>
 *       <ModelMenu value={model} onChange={setModel} variant="quiet" />
 *     </PromptInputTools>
 *     <PromptInputActions>
 *       <PromptInputSubmit />
 *     </PromptInputActions>
 *   </PromptInputFooter>
 * </PromptInput>
 * ```
 */
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

/**
 * Scrollable body region that wraps the textarea.
 * Provides padding around the text input area.
 */
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

/**
 * Footer toolbar displayed below the textarea. Lays out `PromptInputTools`
 * on the left and `PromptInputActions` on the right.
 */
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

/**
 * Left-aligned container in the footer for tool buttons, menus, and controls.
 * Renders with `role="toolbar"` for accessibility. Can be empty to reserve
 * layout space so actions stay right-aligned.
 */
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

/**
 * Right-aligned container in the footer for primary actions like the
 * submit button.
 */
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
