import { forwardRef, ReactNode, Ref, useState } from "react";
import {
  TextField as AriaTextField,
  TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { SizingProps } from "@phoenix/components/types";
import { SizeProvider } from "@phoenix/contexts/SizeContext";

import { CredentialContext } from "./CredentialContext";
import { textFieldCSS } from "./styles";

export interface CredentialFieldProps
  extends Omit<AriaTextFieldProps, "type">,
    SizingProps {
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
          className="ac-credentialfield"
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
