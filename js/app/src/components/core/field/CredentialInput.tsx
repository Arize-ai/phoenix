import { css } from "@emotion/react";
import type { Ref } from "react";
import { useRef } from "react";
import type { InputProps as AriaInputProps } from "react-aria-components";
import { Button, Input as AriaInput } from "react-aria-components";

import { useSize } from "@phoenix/components/core/contexts/SizeContext";

import { Icon, Icons } from "../icon";
import { useCredentialContext } from "./CredentialContext";

export type CredentialInputProps = Omit<AriaInputProps, "type">;

const credentialInputCSS = css`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  // The 2px (e.g. 50) is to account making the buttons slightly bigger
  --credential-button-size: calc(
    var(--textfield-input-height) - 2 * var(--textfield-vertical-padding) +
      var(--global-dimension-size-50)
  );
  --credential-button-gap: var(--global-dimension-size-50);

  &[data-interactive] > input {
    padding-right: calc(
      var(--textfield-vertical-padding) + 2 * var(--credential-button-size) +
        var(--credential-button-gap) + var(--textfield-vertical-padding)
    ) !important; // Don't want to fight specificity here
  }

  .credential-input__actions {
    position: absolute;
    right: var(--textfield-vertical-padding);
    display: flex;
    flex-direction: row-reverse;
    gap: var(--credential-button-gap);
  }

  .credential-input__button {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    width: var(--credential-button-size);
    height: var(--credential-button-size);
    color: var(--global-text-color-700);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--global-rounding-small);
    &[data-hovered] {
      background-color: var(--global-color-gray-300);
    }
    &[data-focus-visible] {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }
  .credential-input__toggle {
    background-color: var(--global-color-gray-200);
  }
`;

/**
 * The input of a `CredentialField`: masked by default, with a toggle at the
 * trailing edge to reveal it and, while the field holds something to remove,
 * a clear button just inside the toggle. Disabled and read-only fields show
 * neither.
 */
function CredentialInput({
  ref,
  ...props
}: CredentialInputProps & { ref?: Ref<HTMLInputElement> }) {
  const { isVisible, setIsVisible, canClear, clear, isInteractive } =
    useCredentialContext();
  const size = useSize();
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      data-size={size}
      data-testid="credential-input"
      data-interactive={isInteractive || undefined}
      css={credentialInputCSS}
    >
      <AriaInput
        {...props}
        ref={(element) => {
          inputRef.current = element;
          if (typeof ref === "function") {
            ref(element);
          } else if (ref) {
            ref.current = element;
          }
        }}
        type={isVisible ? "text" : "password"}
      />
      {isInteractive ? (
        <div className="credential-input__actions">
          <Button
            className="credential-input__button credential-input__toggle"
            onPress={() => setIsVisible(!isVisible)}
            aria-label={isVisible ? "Hide credential" : "Show credential"}
          >
            <Icon svg={isVisible ? <Icons.Eye /> : <Icons.EyeOff />} />
          </Button>
          {canClear ? (
            <Button
              className="credential-input__button credential-input__clear"
              onPress={() => {
                clear();
                inputRef.current?.focus();
              }}
              aria-label="Clear credential"
            >
              <Icon svg={<Icons.Close />} />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { CredentialInput };
