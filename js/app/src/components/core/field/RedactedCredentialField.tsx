import { FieldError, Label } from "react-aria-components";

import { Text } from "@phoenix/components/core/content";
import type { ComponentSize } from "@phoenix/components/core/types";
import { isRedacted, redactedPreviewText } from "@phoenix/utils/redactionUtils";

import { CredentialField } from "./CredentialField";
import { CredentialInput } from "./CredentialInput";

export interface RedactedCredentialFieldProps {
  label: string;
  placeholder?: string;
  description?: string;
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
 * Hidden credential input that round-trips server-issued redacted tokens.
 *
 * The form holds the redacted token (or plaintext, when newly entered); the
 * input is shown empty while the value is still an untouched redacted token,
 * with the masked preview (`••••xyz9`) as its placeholder. The first
 * keystroke flips to direct binding, so typing replaces the stored token.
 * The clear button, or deleting the text, submits an empty value; the reveal
 * toggle shows only what was typed, since the stored value never reaches the
 * client.
 */
export function RedactedCredentialField({
  label,
  placeholder,
  description,
  value,
  onChange,
  onBlur,
  name,
  isDisabled,
  isRequired,
  errorMessage,
  size = "M",
}: RedactedCredentialFieldProps) {
  const showRedactedPlaceholder = isRedacted(value);
  const displayValue = showRedactedPlaceholder ? "" : (value ?? "");
  const inputPlaceholder = showRedactedPlaceholder
    ? (redactedPreviewText(value) ?? "••••••••")
    : placeholder;

  return (
    <CredentialField
      size={size}
      name={name}
      value={displayValue}
      hasHiddenValue={showRedactedPlaceholder}
      onChange={onChange}
      onBlur={onBlur}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
    >
      <Label>{label}</Label>
      <CredentialInput placeholder={inputPlaceholder} />
      {errorMessage ? (
        <FieldError>{errorMessage}</FieldError>
      ) : description ? (
        <Text slot="description">{description}</Text>
      ) : null}
    </CredentialField>
  );
}
