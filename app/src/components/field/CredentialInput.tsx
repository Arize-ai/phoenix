import { forwardRef, Ref } from "react";
import {
  Button,
  Input as AriaInput,
  InputProps as AriaInputProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";
import { useSize } from "@phoenix/contexts/SizeContext";

import { useCredentialContext } from "./CredentialContext";

export interface CredentialInputProps extends Omit<AriaInputProps, "type"> {}

function CredentialInput(
  props: CredentialInputProps,
  ref: Ref<HTMLInputElement>
) {
  const { isVisible, setIsVisible } = useCredentialContext();
  const size = useSize();
  const { disabled, readOnly, ...otherProps } = props;

  return (
    <div
      data-size={size}
      data-testid="credential-input"
      css={css`
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;

        input {
          // Make the toggle button be nestled evenly
          padding-right: var(--textfield-vertical-padding);
        }

        .ac-credential-input__toggle {
          position: absolute;
          right: var(--textfield-horizontal-padding);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          width: calc(
            var(--textfield-input-height) - var(--textfield-vertical-padding)
          );
          height: calc(
            var(--textfield-input-height) - var(--textfield-vertical-padding)
          );
          color: var(--ac-global-text-color-700);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--ac-global-rounding-small);
          transition: background-color 0.2s;

          &:hover {
            background-color: var(--ac-global-color-grey-300);
          }

          &:focus-visible {
            outline: 2px solid var(--ac-global-color-primary);
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
        ref={ref}
        type={isVisible ? "text" : "password"}
        disabled={disabled}
        readOnly={readOnly}
      />
      <Button
        className="ac-credential-input__toggle"
        onPress={() => setIsVisible(!isVisible)}
        isDisabled={disabled || readOnly}
        aria-label={isVisible ? "Hide credential" : "Show credential"}
        excludeFromTabOrder
      >
        <Icon
          svg={isVisible ? <Icons.EyeOutline /> : <Icons.EyeOffOutline />}
        />
      </Button>
    </div>
  );
}

const _CredentialInput = forwardRef(CredentialInput);

export { _CredentialInput as CredentialInput };
