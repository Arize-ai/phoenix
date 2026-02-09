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

type RegexFieldProps = {
  value: string;
  onChange: (value: string) => void;
  isInvalid?: boolean;
  /**
   * Error message to display. If provided, this is shown instead of regex syntax errors.
   */
  error?: string;
  description?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
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
  validateRegex = true,
  ...textFieldProps
}: RegexFieldProps) => {
  const environment = useRelayEnvironment();
  const [internalError, setInternalError] = useState<string | undefined>(
    undefined
  );
  const [isValid, setIsValid] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);

  const debouncedSetValue = useMemo(() => {
    return debounce((newValue: string) => {
      setDebouncedValue(newValue);
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      debouncedSetValue.cancel();
    };
  }, [debouncedSetValue]);

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      if (!validateRegex) {
        return;
      }
      // Clear checkmark immediately on typing, but keep error
      // until revalidated to prevent helptext value flickering
      setIsValid(false);
      debouncedSetValue(newValue);
    },
    [onChange, debouncedSetValue, validateRegex]
  );

  useEffect(() => {
    if (!validateRegex) {
      return;
    }
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

  const error = externalError || internalError;
  const hasError = externalIsInvalid || !!internalError;

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
