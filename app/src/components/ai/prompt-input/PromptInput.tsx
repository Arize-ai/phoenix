import { useRef, useState } from "react";

import { PromptInputContext } from "./PromptInputContext";
import { promptInputContainerCSS } from "./styles";
import type { PromptInputProps } from "./types";

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
export function PromptInput({
  children,
  ref,
  onSubmit,
  status = "ready",
  isDisabled = false,
  mode = "prompt",
  value: controlledValue,
  onValueChange,
  ...restProps
}: PromptInputProps) {
  // Dual-mode value handling:
  //   - Controlled (parent passes `value`): rendered value comes from
  //     `controlledValue`. `internalValue` is unused. Writes are forwarded
  //     to `onValueChange` only — the parent must update its own state for
  //     the new value to appear on screen.
  //   - Uncontrolled (no `value`): we own the state in `internalValue` and
  //     update it on every write. `onValueChange` still fires as an optional
  //     change observer for the parent.
  const [internalValue, setInternalValue] = useState("");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const setValue = (next: string) => {
    if (!isControlled) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };
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
        data-input-mode={mode}
        {...restProps}
      >
        {children}
      </div>
    </PromptInputContext.Provider>
  );
}
