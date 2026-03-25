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
  ...restProps
}: PromptInputProps) {
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
