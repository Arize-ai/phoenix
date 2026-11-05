import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { useState } from "react";
import type { TextFieldProps as AriaTextFieldProps } from "react-aria-components";
import { TextField as AriaTextField } from "react-aria-components";

import { SizeProvider } from "@phoenix/components/core/contexts/SizeContext";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import type { SizingProps } from "@phoenix/components/core/types";

import { CredentialContext } from "./CredentialContext";
import { textFieldCSS } from "./styles";

export interface CredentialFieldProps
  extends Omit<AriaTextFieldProps, "type">, SizingProps {
  children: ReactNode;
  /**
   * A saved value exists that the input does not show, such as a credential
   * stored on the server. The clear button is offered for it, and clearing
   * calls `onChange("")`.
   */
  hasHiddenValue?: boolean;
}

/**
 * A field for a password, API key or token. Its `CredentialInput` reveals the
 * value with a toggle at the trailing edge and, while there is something to
 * remove, offers a clear button just inside it, so the toggle never moves.
 */
function CredentialField({
  ref,
  ...props
}: CredentialFieldProps & { ref?: Ref<HTMLDivElement> }) {
  const {
    size = "M",
    children,
    hasHiddenValue = false,
    value: valueProp,
    defaultValue,
    onChange,
    isDisabled,
    isReadOnly,
    ...otherProps
  } = props;
  const [isVisible, setIsVisible] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? ""
  );
  const value = valueProp ?? uncontrolledValue;
  const setValue = (nextValue: string) => {
    if (valueProp === undefined) {
      setUncontrolledValue(nextValue);
    }
    onChange?.(nextValue);
  };
  const isInteractive = !isDisabled && !isReadOnly;

  return (
    <CredentialContext.Provider
      value={{
        isVisible,
        setIsVisible,
        canClear: isInteractive && (value !== "" || hasHiddenValue),
        clear: () => setValue(""),
        isInteractive,
      }}
    >
      <SizeProvider size={size}>
        <AriaTextField
          data-size={size}
          className="credential-field"
          autoComplete="off"
          ref={ref}
          {...otherProps}
          value={value}
          onChange={setValue}
          isDisabled={isDisabled}
          isReadOnly={isReadOnly}
          css={css(fieldBaseCSS, textFieldCSS)}
        >
          {children}
        </AriaTextField>
      </SizeProvider>
    </CredentialContext.Provider>
  );
}

export { CredentialField };
