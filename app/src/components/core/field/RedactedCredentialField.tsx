import { useState } from "react";
import { FieldError, Input as AriaInput, Label } from "react-aria-components";

import { Text } from "@phoenix/components/core/content";
import type { ComponentSize } from "@phoenix/components/core/types";
import { isRedacted, redactedPreviewText } from "@phoenix/utils/redactionUtils";

import { TextField } from "./TextField";

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
 * rendered input is always `type="password"` and is shown empty while the
 * value is still an untouched redacted token, with the masked preview
 * (`••••xyz9`) as its placeholder. The first keystroke flips to direct
 * binding, so typing replaces the stored token and clearing the field
 * submits an empty value.
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
  const [hasEdited, setHasEdited] = useState(false);
  const showRedactedPlaceholder = !hasEdited && isRedacted(value);
  const displayValue = showRedactedPlaceholder ? "" : (value ?? "");
  const inputPlaceholder = showRedactedPlaceholder
    ? (redactedPreviewText(value) ?? "••••••••")
    : placeholder;

  const handleChange = (next: string) => {
    if (!hasEdited) {
      setHasEdited(true);
    }
    onChange(next);
  };

  return (
    <TextField
      type="password"
      size={size}
      name={name}
      value={displayValue}
      onChange={handleChange}
      onBlur={onBlur}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={Boolean(errorMessage)}
      autoComplete="off"
    >
      <Label>{label}</Label>
      <AriaInput placeholder={inputPlaceholder} />
      {errorMessage ? (
        <FieldError>{errorMessage}</FieldError>
      ) : description ? (
        <Text slot="description">{description}</Text>
      ) : null}
    </TextField>
  );
}
