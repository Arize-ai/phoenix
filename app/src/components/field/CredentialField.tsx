import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { forwardRef, useState } from "react";
import type { TextFieldProps as AriaTextFieldProps } from "react-aria-components";
import { TextField as AriaTextField } from "react-aria-components";

import { fieldBaseCSS } from "@phoenix/components/field/styles";
import type { SizingProps } from "@phoenix/components/types";
import { SizeProvider } from "@phoenix/contexts/SizeContext";

import { CredentialContext } from "./CredentialContext";
import { textFieldCSS } from "./styles";

export interface CredentialFieldProps
  extends Omit<AriaTextFieldProps, "type">, SizingProps {
  children: ReactNode;
}

function CredentialField(
  props: CredentialFieldProps,
  ref: Ref<HTMLDivElement>
) {
  const { size = "M", children, ...otherProps } = props;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <CredentialContext.Provider value={{ isVisible, setIsVisible }}>
      <SizeProvider size={size}>
        <AriaTextField
          data-size={size}
          className="credential-field"
          autoComplete="off"
          ref={ref}
          {...otherProps}
          css={css(fieldBaseCSS, textFieldCSS)}
        >
          {children}
        </AriaTextField>
      </SizeProvider>
    </CredentialContext.Provider>
  );
}

const _CredentialField = forwardRef(CredentialField);

export { _CredentialField as CredentialField };
