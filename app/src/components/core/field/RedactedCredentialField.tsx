import { css } from "@emotion/react";
import { useCallback, useState } from "react";
import {
  FieldError,
  Input as AriaInput,
  Label,
  TextField as AriaTextField,
} from "react-aria-components";

import { IconButton } from "@phoenix/components/core/button/IconButton";
import { Icon, Icons } from "@phoenix/components/core/icon";
import type { ComponentSize } from "@phoenix/components/core/types";
import { isRedacted, redactedPreviewText } from "@phoenix/utils/redactedString";

import { CredentialField } from "./CredentialField";
import { CredentialInput } from "./CredentialInput";
import { fieldBaseCSS, textFieldCSS } from "./styles";

export interface RedactedCredentialFieldProps {
  label: string;
  placeholder?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  errorMessage?: string;
  size?: Exclude<ComponentSize, never>;
}

/**
 * Credential input for fields that return as a server-redacted token.
 *
 * Sealed state shows the preview mask (`••••xyz9`) with an edit icon. Pressing
 * edit clears the stored redacted token off form state (stashing it for cancel)
 * and opens a CredentialInput (with its built-in show/hide toggle) flanked by X
 * (restore the stashed token → sealed) and ✓ (confirm, exits editing and
 * triggers onBlur-mode validation). A never-redacted or already-edited value
 * renders as a plain CredentialInput with no extra icons.
 *
 * The input is bound directly to `value`/`onChange` while editing, so typed
 * edits are live in form state — form-level submit and peer widgets (e.g. a
 * Test Connection button) always see what's on screen, not a stale value.
 */
export function RedactedCredentialField({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  name,
  isDisabled,
  isRequired,
  errorMessage,
  size = "M",
}: RedactedCredentialFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  // The full redacted token captured at enterEdit, restored on cancel.
  const [savedValue, setSavedValue] = useState<string | null>(null);

  const hasRedactedValue = isRedacted(value);
  const sealed = hasRedactedValue && !isEditing;
  const invalid = Boolean(errorMessage);

  const enterEdit = useCallback(() => {
    setSavedValue(typeof value === "string" ? value : "");
    onChange("");
    setIsEditing(true);
  }, [onChange, value]);

  const cancel = useCallback(() => {
    if (savedValue !== null) {
      onChange(savedValue);
    }
    setSavedValue(null);
    setIsEditing(false);
  }, [onChange, savedValue]);

  const accept = useCallback(() => {
    // Value is already in form state — just close the editor and let
    // react-hook-form's onBlur-mode validation run immediately.
    onBlur?.();
    setSavedValue(null);
    setIsEditing(false);
  }, [onBlur]);

  if (sealed) {
    const mask = redactedPreviewText(value) ?? "••••••••";
    return (
      <AriaTextField
        data-size={size}
        value={mask}
        isReadOnly
        isDisabled={isDisabled}
        isInvalid={invalid}
        css={css(fieldBaseCSS, textFieldCSS, rowCSS)}
      >
        <Label>{label}</Label>
        <div className="redacted-row">
          <AriaInput />
          <IconButton
            size="S"
            onPress={enterEdit}
            aria-label="Edit credential"
            isDisabled={isDisabled}
          >
            <Icon svg={<Icons.EditOutline />} />
          </IconButton>
        </div>
        {errorMessage && <FieldError>{errorMessage}</FieldError>}
      </AriaTextField>
    );
  }

  if (isEditing) {
    return (
      <CredentialField
        value={value ?? ""}
        onChange={onChange}
        isDisabled={isDisabled}
        isRequired={isRequired}
        isInvalid={invalid}
        name={name}
        size={size}
        css={rowCSS}
      >
        <Label>{label}</Label>
        <div className="redacted-row">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <CredentialInput placeholder={placeholder} autoFocus />
          <IconButton
            size="S"
            onPress={cancel}
            aria-label="Cancel edit"
            isDisabled={isDisabled}
          >
            <Icon svg={<Icons.CloseOutline />} />
          </IconButton>
          <IconButton
            size="S"
            onPress={accept}
            aria-label="Accept edit"
            isDisabled={isDisabled}
          >
            <Icon svg={<Icons.CheckmarkOutline />} />
          </IconButton>
        </div>
        {errorMessage && <FieldError>{errorMessage}</FieldError>}
      </CredentialField>
    );
  }

  // Plain mode — no saved redacted value to revert to.
  return (
    <CredentialField
      value={value ?? ""}
      onChange={onChange}
      onBlur={onBlur}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={invalid}
      name={name}
      size={size}
    >
      <Label>{label}</Label>
      <CredentialInput placeholder={placeholder} />
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
    </CredentialField>
  );
}

const rowCSS = css`
  .redacted-row {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-75);
    width: 100%;
    [data-testid="credential-input"],
    .react-aria-Input {
      flex: 1 1 auto;
    }
  }
`;
