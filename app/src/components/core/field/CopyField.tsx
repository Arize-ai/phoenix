import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import type { TextFieldProps as AriaTextFieldProps } from "react-aria-components";
import { TextField as AriaTextField } from "react-aria-components";

import { SizeProvider } from "@phoenix/components/core/contexts/SizeContext";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import type { SizingProps } from "@phoenix/components/core/types";

import { selectReadOnlyInputOnFocus } from "./selectReadOnlyInputOnFocus";
import { textFieldCSS } from "./styles";

export interface CopyFieldProps
  extends Omit<AriaTextFieldProps, "type" | "isReadOnly">, SizingProps {
  children: ReactNode;
}

function CopyField({
  ref,
  ...props
}: CopyFieldProps & { ref?: Ref<HTMLDivElement> }) {
  const { size = "M", children, onFocus, ...otherProps } = props;

  return (
    <SizeProvider size={size}>
      <AriaTextField
        data-size={size}
        className="copy-field"
        isReadOnly
        ref={ref}
        {...otherProps}
        onFocus={(event) => {
          onFocus?.(event);
          selectReadOnlyInputOnFocus(event);
        }}
        css={css(fieldBaseCSS, textFieldCSS)}
      >
        {children}
      </AriaTextField>
    </SizeProvider>
  );
}

export { CopyField };
