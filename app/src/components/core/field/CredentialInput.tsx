import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import type { MutableRefObject, Ref } from "react";
import { forwardRef, useCallback, useRef, useState } from "react";
import type { InputProps as AriaInputProps } from "react-aria-components";
import { Input as AriaInput } from "react-aria-components";

import { IconButton } from "../button";
import { Icon, Icons } from "../icon";
import { Tooltip, TooltipTrigger } from "../tooltip";
import { useCredentialContext } from "./CredentialContext";

export type CredentialInputProps = Omit<AriaInputProps, "type">;

const SHOW_COPIED_TIMEOUT_MS = 2000;

const credentialInputCSS = css`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;

  & > input {
    padding-right: calc(
      var(--global-dimension-size-50) + var(--credential-actions-width) +
        var(--global-dimension-size-50)
    ) !important;
  }

  .credential-input__actions {
    position: absolute;
    right: var(--global-dimension-size-50);
    display: flex;
    align-items: center;
  }
`;

function CredentialInput(
  props: CredentialInputProps,
  forwardedRef: Ref<HTMLInputElement>
) {
  const { isVisible, setIsVisible, isDisabled, copyable } =
    useCredentialContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as MutableRefObject<HTMLInputElement | null>).current =
          node;
      }
    },
    [forwardedRef]
  );

  const onCopy = useCallback(() => {
    if (inputRef.current) {
      copy(inputRef.current.value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), SHOW_COPIED_TIMEOUT_MS);
    }
  }, []);

  return (
    <div
      data-testid="credential-input"
      css={credentialInputCSS}
      style={
        {
          "--credential-actions-width": copyable
            ? "calc(var(--global-button-height-s) * 2)"
            : "var(--global-button-height-s)",
        } as React.CSSProperties
      }
    >
      <AriaInput
        {...props}
        ref={setRef}
        type={isVisible ? "text" : "password"}
      />
      <div className="credential-input__actions">
        {copyable && (
          <TooltipTrigger delay={500}>
            <IconButton
              size="S"
              onPress={onCopy}
              isDisabled={isDisabled}
              aria-label="Copy"
            >
              <Icon svg={isCopied ? <Icons.Checkmark /> : <Icons.Copy />} />
            </IconButton>
            <Tooltip offset={5}>{isCopied ? "Copied" : "Copy"}</Tooltip>
          </TooltipTrigger>
        )}
        <IconButton
          size="S"
          onPress={() => setIsVisible(!isVisible)}
          isDisabled={isDisabled}
          aria-label={isVisible ? "Hide credential" : "Show credential"}
        >
          <Icon
            svg={isVisible ? <Icons.EyeOutline /> : <Icons.EyeOffOutline />}
          />
        </IconButton>
      </div>
    </div>
  );
}

const _CredentialInput = forwardRef(CredentialInput);

export { _CredentialInput as CredentialInput };
