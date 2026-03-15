import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { forwardRef, useState } from "react";
import type { TextFieldProps as AriaTextFieldProps } from "react-aria-components";
import { TextField as AriaTextField } from "react-aria-components";

import { SizeProvider } from "@phoenix/components/core/contexts/SizeContext";
import {
  fieldBaseCSS,
  readOnlyInputCSS,
} from "@phoenix/components/core/field/styles";
import type { SizingProps } from "@phoenix/components/core/types";

import { CredentialContext } from "./CredentialContext";
import { textFieldCSS } from "./styles";

export interface CredentialFieldProps
  extends Omit<AriaTextFieldProps, "type">, SizingProps {
  children: ReactNode;
  /**
   * When true, renders an inline copy-to-clipboard button alongside the
   * visibility toggle. Copy works regardless of whether the value is revealed.
   * @default false
   */
  copyable?: boolean;
}

function CredentialField(
  props: CredentialFieldProps,
  ref: Ref<HTMLDivElement>
) {
  const { size = "M", copyable = false, children, ...otherProps } = props;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <CredentialContext.Provider
      value={{
        isVisible,
        setIsVisible,
        isDisabled: otherProps.isDisabled,
        isReadOnly: otherProps.isReadOnly,
        copyable,
      }}
    >
      <SizeProvider size={size}>
        <AriaTextField
          data-size={size}
          className="credential-field"
          autoComplete="off"
          ref={ref}
          {...otherProps}
          css={css(
            fieldBaseCSS,
            textFieldCSS,
            otherProps.isReadOnly && readOnlyInputCSS
          )}
        >
          {children}
        </AriaTextField>
      </SizeProvider>
    </CredentialContext.Provider>
  );
}

const _CredentialField = forwardRef(CredentialField);

export { _CredentialField as CredentialField };
