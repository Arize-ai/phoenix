import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import type { Ref } from "react";
import { useCallback, useRef, useState } from "react";
import type { InputProps as AriaInputProps } from "react-aria-components";
import { Button, Input as AriaInput } from "react-aria-components";

import { useSize } from "@phoenix/components/core/contexts/SizeContext";

import { Icon } from "../icon";
import { Tooltip, TooltipTrigger } from "../tooltip";

const SHOW_COPIED_TIMEOUT_MS = 2000;

export type CopyInputProps = Omit<AriaInputProps, "type">;

/**
 * A readonly text input with an embedded copy-to-clipboard button.
 * Designed to be used inside a CopyField component.
 */
function CopyInput({
  ref,
  ...props
}: CopyInputProps & { ref?: Ref<HTMLInputElement> }) {
  const size = useSize();
  const { disabled, ...otherProps } = props;
  const [isCopied, setIsCopied] = useState(false);
  const internalRef = useRef<HTMLInputElement>(null);

  const onCopy = useCallback(() => {
    const value = internalRef.current?.value ?? "";
    copy(value);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, SHOW_COPIED_TIMEOUT_MS);
  }, []);

  return (
    <div
      data-size={size}
      data-testid="copy-input"
      css={css`
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        --copy-button-size: calc(
          var(--textfield-input-height) - 2 * var(--textfield-vertical-padding) +
            var(--global-dimension-size-50)
        );

        & > input {
          padding-right: calc(
            var(--textfield-vertical-padding) + var(--copy-button-size) +
              var(--textfield-vertical-padding)
          ) !important;
        }

        .copy-input__copy-button {
          position: absolute;
          right: var(--textfield-vertical-padding);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          width: var(--copy-button-size);
          height: var(--copy-button-size);
          color: var(--global-text-color-700);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--global-rounding-small);
          transition: background-color 0.2s;
          background-color: var(--global-color-gray-200);
          &:hover {
            background-color: var(--global-color-gray-300);
          }

          &:focus-visible {
            outline: 2px solid var(--global-color-primary);
            outline-offset: 2px;
          }

          &[disabled] {
            cursor: not-allowed;
            opacity: 0.5;
          }
        }
      `}
    >
      <AriaInput
        {...otherProps}
        ref={(node) => {
          internalRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        type="text"
        readOnly
        disabled={disabled}
      />
      <TooltipTrigger>
        <Button
          className="copy-input__copy-button"
          onPress={onCopy}
          isDisabled={disabled}
          aria-label={isCopied ? "Copied" : "Copy to clipboard"}
        >
          <Icon
            color={isCopied ? "success" : "inherit"}
            svgKey={isCopied ? "Checkmark" : "DuplicateOutline"}
          />
        </Button>
        <Tooltip offset={1}>{isCopied ? "Copied" : "Copy"}</Tooltip>
      </TooltipTrigger>
    </div>
  );
}

export { CopyInput };
