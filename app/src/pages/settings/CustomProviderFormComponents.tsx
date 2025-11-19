/**
 * Reusable form field components for provider configuration
 * These provide consistent styling and validation for advanced settings
 */

import { useCallback, useEffect, useState } from "react";
import { Control, Controller } from "react-hook-form";
import { JSONSchema7 } from "json-schema";

import { Card, Flex, Text, View } from "@phoenix/components";
import { CodeEditorFieldWrapper } from "@phoenix/components/code";
import { JSONEditor } from "@phoenix/components/code/JSONEditor";
import {
  httpHeadersJSONSchema,
  stringToHttpHeadersSchema,
} from "@phoenix/schemas/httpHeadersSchema";

import { ProviderFormData } from "./CustomProviderForm";

/**
 * Generic JSON validator for form fields
 * Allows empty values, validates non-empty values must be valid JSON
 */
export function validateJsonField(value: string | undefined): string | true {
  if (!value || value.trim() === "" || value.trim() === "{}") {
    return true; // Empty is valid
  }
  try {
    JSON.parse(value);
    return true;
  } catch {
    return "Invalid JSON format";
  }
}

interface AdvancedSettingsCardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AdvancedSettingsCard({
  children,
  title = "Advanced Settings",
  description = "Optional advanced configuration. Leave blank to use sensible defaults.",
}: AdvancedSettingsCardProps) {
  return (
    <div
      onClick={(e) => {
        // Only stop propagation if the click is on the card header/button
        // Allow clicks inside the card body to propagate normally
        if (
          (e.target as HTMLElement).closest(".card__collapsible-button") ||
          (e.target as HTMLElement).closest("header")
        ) {
          e.stopPropagation();
        }
      }}
      style={{ width: "100%" }}
    >
      <Card
        title={title}
        collapsible
        defaultOpen={false}
        titleSeparator={false}
      >
        <View padding="size-200" paddingTop="size-100">
          <Flex direction="column" gap="size-100">
            <Text size="S" color="text-700">
              {description}
            </Text>
            {children}
          </Flex>
        </View>
      </Card>
    </div>
  );
}

interface JSONFieldProps {
  name: string; // Allow any string since ProviderFormData is a discriminated union
  control: Control<ProviderFormData>;
  label: string;
  placeholder?: string;
  description: string;
  jsonSchema?: JSONSchema7;
  validator?: (value: string) => string | true;
}

/**
 * Internal editor component that handles state and validation
 */
function JSONEditorWithValidation({
  value,
  onChange,
  label,
  placeholder,
  description,
  jsonSchema,
  validator,
  fieldError,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  description: string;
  jsonSchema?: JSONSchema7;
  validator: (value: string) => string | true;
  fieldError?: string;
}) {
  const [editorValue, setEditorValue] = useState(value || "");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Sync with external value changes
  useEffect(() => {
    setEditorValue(value || "");
  }, [value]);

  const handleChange = useCallback(
    (newValue: string) => {
      setEditorValue(newValue);

      // Validate the new value
      const validationResult = validator(newValue);
      if (validationResult === true) {
        setErrorMessage(undefined);
        onChange(newValue);
      } else {
        setErrorMessage(validationResult);
        onChange(newValue); // Store the invalid value so user doesn't lose work
      }
    },
    [onChange, validator]
  );

  return (
    <CodeEditorFieldWrapper
      label={label}
      errorMessage={errorMessage || fieldError}
      description={!errorMessage && !fieldError ? description : undefined}
    >
      <JSONEditor
        value={editorValue}
        onChange={handleChange}
        jsonSchema={jsonSchema}
        placeholder={placeholder}
        optionalLint
      />
    </CodeEditorFieldWrapper>
  );
}

/**
 * JSON field using the codebase's established JSONEditor pattern
 * Provides real-time validation feedback for consistent UX
 * Matches the pattern from ModelConfigButton.tsx
 */
export function JSONField({
  name,
  control,
  label,
  placeholder,
  description,
  jsonSchema,
  validator = validateJsonField,
}: JSONFieldProps) {
  return (
    <Controller
      // @ts-expect-error - name can be any field from the discriminated union
      name={name}
      control={control}
      render={({ field: { value, onChange }, fieldState: { error } }) => (
        <JSONEditorWithValidation
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          label={label}
          placeholder={placeholder}
          description={description}
          jsonSchema={jsonSchema}
          validator={validator}
          fieldError={error?.message}
        />
      )}
    />
  );
}

/**
 * Internal editor component for HTTP headers with RFC 7230 validation
 */
function HeadersEditorWithValidation({
  value,
  onChange,
  label,
  placeholder,
  description,
  fieldError,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  description: string;
  fieldError?: string;
}) {
  const [editorValue, setEditorValue] = useState(value || "");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Sync with external value changes
  useEffect(() => {
    setEditorValue(value || "");
  }, [value]);

  const handleChange = useCallback(
    (newValue: string) => {
      setEditorValue(newValue);

      const result = stringToHttpHeadersSchema.safeParse(newValue);
      if (result.success) {
        setErrorMessage(undefined);
        // Convert headers object back to JSON string for form storage
        onChange(result.data ? JSON.stringify(result.data) : "");
      } else {
        const firstError = result.error.errors[0];
        setErrorMessage(firstError?.message ?? "Invalid headers format");
        onChange(newValue); // Store the invalid value so user doesn't lose work
      }
    },
    [onChange]
  );

  return (
    <CodeEditorFieldWrapper
      label={label}
      errorMessage={errorMessage || fieldError}
      description={!errorMessage && !fieldError ? description : undefined}
    >
      <JSONEditor
        value={editorValue}
        onChange={handleChange}
        jsonSchema={httpHeadersJSONSchema as JSONSchema7}
        placeholder={placeholder || '{"X-Custom-Header": "custom-value"}'}
        optionalLint
      />
    </CodeEditorFieldWrapper>
  );
}

/**
 * Validated HTTP Headers field using the established httpHeadersSchema
 * with RFC 7230 compliant validation
 */
export function HeadersField({
  name,
  control,
  label = "Custom Headers (JSON)",
  placeholder,
  description = "Additional HTTP headers as JSON object",
}: {
  name: string; // Allow any string since ProviderFormData is a discriminated union
  control: Control<ProviderFormData>;
  label?: string;
  placeholder?: string;
  description?: string;
  isSubmitting?: boolean;
}) {
  return (
    <Controller
      // @ts-expect-error - name can be any field from the discriminated union
      name={name}
      control={control}
      render={({ field: { value, onChange }, fieldState: { error } }) => (
        <HeadersEditorWithValidation
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          label={label}
          placeholder={placeholder}
          description={description}
          fieldError={error?.message}
        />
      )}
    />
  );
}
