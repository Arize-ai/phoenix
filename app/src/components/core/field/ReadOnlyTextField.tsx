import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import type { ReactNode, Ref } from "react";
import { forwardRef, useCallback, useState } from "react";
import {
  Input,
  Label,
  TextField as AriaTextField,
} from "react-aria-components";

import { IconButton } from "../button";
import { Text } from "../content";
import { Icon, Icons } from "../icon";
import { Tooltip, TooltipTrigger } from "../tooltip";
import type { SizingProps } from "../types";
import { fieldBaseCSS, readOnlyInputCSS, textFieldCSS } from "./styles";

const SHOW_COPIED_TIMEOUT_MS = 2000;

export interface ReadOnlyTextFieldProps extends SizingProps {
  /**
   * The field value to display.
   */
  value: string;
  /**
   * The field label.
   */
  label: string;
  /**
   * Optional description text displayed below the input.
   */
  description?: ReactNode;
  /**
   * When true, renders an inline copy button inside the input.
   * @default false
   */
  copyable?: boolean;
}

const readOnlyFieldCSS = css`
  .read-only-text-field__input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  &[data-copyable] .read-only-text-field__input-wrapper > input {
    padding-right: calc(
      var(--global-dimension-size-50) + var(--global-button-height-s) +
        var(--global-dimension-size-50)
    );
  }

  .read-only-text-field__copy {
    position: absolute;
    right: var(--global-dimension-size-50);
  }
`;

/**
 * A read-only text field for displaying values that users may want to select
 * or copy. Optionally renders an inline copy-to-clipboard button inside the
 * input, following the same visual pattern as CredentialInput.
 */
function ReadOnlyTextField(
  props: ReadOnlyTextFieldProps,
  ref: Ref<HTMLDivElement>
) {
  const { value, label, description, copyable = false, size = "M" } = props;
  const [isCopied, setIsCopied] = useState(false);

  const onCopy = useCallback(() => {
    copy(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), SHOW_COPIED_TIMEOUT_MS);
  }, [value]);

  return (
    <AriaTextField
      value={value}
      isReadOnly
      data-size={size}
      data-copyable={copyable || undefined}
      className="read-only-text-field"
      ref={ref}
      css={css(fieldBaseCSS, textFieldCSS, readOnlyInputCSS, readOnlyFieldCSS)}
    >
      <Label>{label}</Label>
      <div className="read-only-text-field__input-wrapper">
        <Input />
        {copyable && (
          <TooltipTrigger delay={500}>
            <IconButton
              className="read-only-text-field__copy"
              size="S"
              onPress={onCopy}
              aria-label="Copy"
            >
              <Icon svg={isCopied ? <Icons.Checkmark /> : <Icons.Copy />} />
            </IconButton>
            <Tooltip offset={5}>{isCopied ? "Copied" : "Copy"}</Tooltip>
          </TooltipTrigger>
        )}
      </div>
      {description && <Text slot="description">{description}</Text>}
    </AriaTextField>
  );
}

const _ReadOnlyTextField = forwardRef(ReadOnlyTextField);
export { _ReadOnlyTextField as ReadOnlyTextField };
