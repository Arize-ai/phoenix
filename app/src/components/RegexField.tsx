import { useEffect, useMemo, useState } from "react";
import { FieldError, Input, Label } from "react-aria-components";
import { fetchQuery, graphql, useRelayEnvironment } from "react-relay";
import { debounce } from "lodash";

import { RegexFieldQuery } from "@phoenix/components/__generated__/RegexFieldQuery.graphql";
import { Text } from "@phoenix/components/content";
import { TextField, TextFieldProps } from "@phoenix/components/field";
import { Icon, Icons } from "@phoenix/components/icon";

type RegexFieldProps = {
  value: string;
  onChange: (value: string) => void;
  isInvalid?: boolean;
  error?: string;
  description?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
} & Omit<TextFieldProps, "isInvalid" | "onChange">;

export const RegexField = ({
  value,
  onChange,
  error,
  isInvalid,
  description,
  label,
  ariaLabel,
  placeholder,
  ...textFieldProps
}: RegexFieldProps) => {
  return (
    <TextField
      isInvalid={isInvalid}
      aria-label={ariaLabel || label}
      value={value}
      onChange={onChange}
      {...textFieldProps}
    >
      {label && <Label>{label}</Label>}
      <Input placeholder={placeholder} />
      {!error && description && <Text slot="description">{description}</Text>}
      {error && <FieldError>{error}</FieldError>}
      {isInvalid && value && (
        <Icon
          style={{ color: "var(--ac-global-color-danger)" }}
          svg={<Icons.CloseCircle />}
        />
      )}
      {!isInvalid && value && (
        <Icon
          style={{ color: "var(--ac-global-color-success)" }}
          svg={<Icons.CheckmarkCircleFilled />}
        />
      )}
    </TextField>
  );
};

const regexFieldQuery = graphql`
  query RegexFieldQuery($input: String!) {
    validateRegularExpression(regex: $input) {
      isValid
      errorMessage
    }
  }
`;

export const useRegexField = (
  {
    initialValue,
  }: {
    initialValue: string;
  } = { initialValue: "" }
): RegexFieldProps => {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [error, setError] = useState<string | undefined>(undefined);
  const environment = useRelayEnvironment();
  const debouncedSetValue = useMemo(() => {
    return debounce((value: string) => {
      setDebouncedValue(value);
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
