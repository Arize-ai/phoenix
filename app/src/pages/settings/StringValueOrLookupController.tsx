import { Control, Controller, FieldValues, Path } from "react-hook-form";

import { Text, View } from "@phoenix/components";

import { StringValueOrLookupField } from "./StringValueOrLookupField";

const ENV_VAR_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface StringValueOrLookupControllerProps<
  T extends FieldValues,
  K extends Path<T>,
  E extends Path<T>,
> {
  control: Control<T>;
  valueName: K;
  isEnvVarName: E;
  label: string;
  placeholder?: string;
  envVarPlaceholder?: string;
  description?: string;
  isPassword?: boolean;
  isRequired?: boolean;
}

/**
 * Helper component to integrate StringValueOrLookupField with react-hook-form
 * This manages both the value field and the corresponding _is_env_var field
 */
export function StringValueOrLookupController<
  T extends FieldValues,
  K extends Path<T>,
  E extends Path<T>,
>({
  control,
  valueName,
  isEnvVarName,
  label,
  placeholder,
  envVarPlaceholder,
  description,
  isPassword = false,
  isRequired = false,
}: StringValueOrLookupControllerProps<T, K, E>) {
  return (
    <Controller
      name={valueName}
      control={control}
      rules={{
        validate: (value, formValues) => {
          if (isRequired && (!value || (value as string).trim() === "")) {
            return `${label} is required`;
          }

          // Check if environment variable mode is active
          const isEnvVar = formValues[isEnvVarName];
          if (isEnvVar && value && !ENV_VAR_REGEX.test(value as string)) {
            return "Invalid environment variable name. Use alphanumeric characters and underscores.";
          }

          return true;
        },
      }}
      render={({ field: valueField, fieldState: { error } }) => (
        <Controller
          name={isEnvVarName}
          control={control}
          render={({ field: isEnvVarField }) => (
            <View>
              <StringValueOrLookupField
                label={label}
                value={(valueField.value as string) || ""}
                isEnvVar={!!isEnvVarField.value}
                onChange={(value, isEnvVar) => {
                  valueField.onChange(value);
                  isEnvVarField.onChange(isEnvVar);
                }}
                placeholder={placeholder}
                envVarPlaceholder={envVarPlaceholder}
                description={description}
                isPassword={isPassword}
                isRequired={isRequired}
              />
              {error && (
                <Text color="danger" size="S">
                  {error.message}
                </Text>
              )}
            </View>
          )}
        />
      )}
    />
  );
}
