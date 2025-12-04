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

export type CredentialInputProps = Omit<AriaInputProps, "type">;

/**
 * A specialized text field for entering sensitive information like passwords, API keys, and tokens.
 * Features a toggle button to show/hide the credential value.
 *
 * @param props - The props for the CredentialInput component.
 * @param ref - The ref for the CredentialInput component.
 * @returns The CredentialInput component.
 */
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
        // The 2px (e.g. 50) is to account making the toggle button to be slightly bigger
        --credential-visibility-toggle-size: calc(
          var(--textfield-input-height) - 2 *
            var(--textfield-vertical-padding) +
            var(--ac-global-dimension-size-50)
        );

        & > input {
          padding-right: calc(
            var(--textfield-vertical-padding) +
              var(--credential-visibility-toggle-size) +
              var(--textfield-vertical-padding)
          ) !important; // Don't want to fight specificity here
        }

        .ac-credential-input__toggle {
          position: absolute;
          right: var(
            --textfield-vertical-padding
          ); // We want it to be nestled evenly
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          width: var(--credential-visibility-toggle-size);
          height: var(--credential-visibility-toggle-size);
          color: var(--ac-global-text-color-700);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--ac-global-rounding-small);
          transition: background-color 0.2s;
          background-color: var(--ac-global-color-grey-200);
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
