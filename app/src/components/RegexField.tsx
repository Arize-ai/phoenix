import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldError, Input, Label } from "react-aria-components";
import { fetchQuery, graphql, useRelayEnvironment } from "react-relay";
import { debounce } from "lodash";

import { RegexFieldQuery } from "@phoenix/components/__generated__/RegexFieldQuery.graphql";
import { Text } from "@phoenix/components/content";
import {
  FieldDangerIcon,
  FieldSuccessIcon,
  TextField,
  TextFieldProps,
} from "@phoenix/components/field";

/**
 * Default debounce delay in milliseconds before sending validation request.
 * This prevents excessive requests while the user is typing.
 */
const DEFAULT_VALIDATION_DELAY_MS = 250;

type RegexFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /**
   * External isInvalid prop from form validation (e.g., react-hook-form).
   * This is combined with internal validation state.
   */
  isInvalid?: boolean;
  /**
   * External error message from form validation.
   * Takes precedence over internal validation error.
   */
  error?: string;
  description?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  /**
   * Delay in milliseconds before validating the regex after user input.
   * Defaults to 250ms.
   */
  validationDelayMs?: number;
  /**
   * Whether to validate the regex against the backend.
   * Defaults to true.
   */
  validateRegex?: boolean;
} & Omit<TextFieldProps, "isInvalid" | "onChange">;

const regexFieldQuery = graphql`
  query RegexFieldQuery($input: String!) {
    validateRegularExpression(regex: $input) {
      isValid
      errorMessage
    }
  }
`;

export const RegexField = ({
  value,
  onChange,
  error: externalError,
  isInvalid: externalIsInvalid,
  description,
  label,
  ariaLabel,
  placeholder,
  validationDelayMs = DEFAULT_VALIDATION_DELAY_MS,
  validateRegex = true,
  ...textFieldProps
}: RegexFieldProps) => {
  const environment = useRelayEnvironment();

  // Internal validation error from backend - persists until server says valid
  const [internalError, setInternalError] = useState<string | undefined>(
    undefined
  );

  // Track if current value has been validated as valid (for showing checkmark)
  const [isValid, setIsValid] = useState(false);

  // The value that will be validated after debounce settles
  const [debouncedValue, setDebouncedValue] = useState(value);

  // Create a stable debounced setter
  const debouncedSetValue = useMemo(() => {
    return debounce((newValue: string) => {
      setDebouncedValue(newValue);
    }, validationDelayMs);
  }, [validationDelayMs]);

  // Cancel debounced setter on unmount
  useEffect(() => {
    return () => {
      debouncedSetValue.cancel();
    };
  }, [debouncedSetValue]);

  // Handle input changes
  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);

      if (!validateRegex) {
        return;
      }

      // Clear the valid checkmark when user types (but keep error message)
      setIsValid(false);

      // Schedule validation
      debouncedSetValue(newValue);
    },
    [onChange, debouncedSetValue, validateRegex]
  );

  // Validate when debounced value changes
  useEffect(() => {
    if (!validateRegex) {
      return;
    }

    // Empty field: clear everything
    if (!debouncedValue) {
      setInternalError(undefined);
      setIsValid(false);
      return;
    }

    const query = fetchQuery<RegexFieldQuery>(environment, regexFieldQuery, {
      input: debouncedValue,
    });

    const subscription = query.subscribe({
      next: (data) => {
        if (data.validateRegularExpression.isValid) {
          setInternalError(undefined);
          setIsValid(true);
        } else {
          setInternalError(
            data.validateRegularExpression.errorMessage ??
              "Regular expression is invalid"
          );
          setIsValid(false);
        }
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [validateRegex, debouncedValue, environment]);

  // Validate on mount if there's an initial value
  useEffect(() => {
    if (validateRegex && value) {
      setDebouncedValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Combine external and internal errors
  const error = externalError || internalError;
  const hasError = externalIsInvalid || !!internalError;

  // Determine which icon to show
  const renderValidationIcon = () => {
    if (!value) {
      return null;
    }

    if (externalIsInvalid || externalError || internalError) {
      return <FieldDangerIcon />;
    }

    if (isValid) {
      return <FieldSuccessIcon />;
    }

    return null;
  };

  return (
    <TextField
      isInvalid={hasError}
      aria-label={ariaLabel || label}
      value={value}
      onChange={handleChange}
      {...textFieldProps}
    >
      {label && <Label>{label}</Label>}
      <Input placeholder={placeholder} />
      {!error && description && <Text slot="description">{description}</Text>}
      {error && <FieldError>{error}</FieldError>}
      {renderValidationIcon()}
    </TextField>
  );
};

/**
 * Hook for using RegexField as a controlled component with validation.
 * Returns props that can be spread onto RegexField.
 *
 * @deprecated Use RegexField directly with validateRegex=true instead.
 * This hook is kept for backward compatibility.
 */
export const useRegexField = (
  {
    initialValue,
  }: {
    initialValue: string;
  } = { initialValue: "" }
): Pick<RegexFieldProps, "value" | "onChange" | "isInvalid" | "error"> => {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [error, setError] = useState<string | undefined>(undefined);
  const environment = useRelayEnvironment();
  const debouncedSetValue = useMemo(() => {
    return debounce((val: string) => {
      setDebouncedValue(val);
    }, 500);
  }, []);

  // sync the value to the debounced value
  useEffect(() => {
    debouncedSetValue(value);
  }, [value, debouncedSetValue]);

  // when debounced value settles (changes after timeout), fetch the query
  // and update the error state. This will cancel in progress queries.
  useEffect(() => {
    if (!debouncedValue) {
      setError(undefined);
      return;
    }

    const query = fetchQuery<RegexFieldQuery>(environment, regexFieldQuery, {
      input: debouncedValue,
    });

    const req = query.subscribe({
      next: (data) => {
        if (data.validateRegularExpression.isValid) {
          setError(undefined);
        } else {
          setError(
            data.validateRegularExpression.errorMessage ??
              "Regular expression is invalid"
          );
        }
      },
    });

    return () => {
      req.unsubscribe();
    };
  }, [debouncedValue, environment]);

  return {
    value,
    onChange: setValue,
    isInvalid: error != null,
    error,
  };
};
