import { useState } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  Text,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";

interface StringValueOrLookupFieldProps {
  label: string;
  value: string;
  isEnvVar: boolean;
  onChange: (value: string, isEnvVar: boolean) => void;
  placeholder?: string;
  envVarPlaceholder?: string;
  description?: string;
  isPassword?: boolean;
  isRequired?: boolean;
}

export function StringValueOrLookupField({
  label,
  value,
  isEnvVar,
  onChange,
  placeholder,
  envVarPlaceholder,
  description,
  isPassword = false,
  isRequired = false,
}: StringValueOrLookupFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const handleToggleMode = () => {
    onChange(value, !isEnvVar);
  };

  const inputType =
    isPassword && !isEnvVar && !showPassword ? "password" : "text";

  const effectivePlaceholder = isEnvVar
    ? envVarPlaceholder || placeholder
    : placeholder;

  return (
    <View>
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        <Label>
          {label}
          {isRequired && (
            <Text color="danger" elementType="span">
              {" "}
              *
            </Text>
          )}
        </Label>
        <TooltipTrigger delay={0}>
          <Button
            variant="default"
            onClick={handleToggleMode}
            aria-label={
              isEnvVar
                ? "Switch to direct value"
                : "Switch to environment variable"
            }
          >
            <Icon svg={<Icons.Code />} />
            <Text>{isEnvVar ? "Env Var" : "Direct"}</Text>
          </Button>
          <Tooltip>
            {isEnvVar
              ? "Currently using environment variable. Click to switch to direct value."
              : "Currently using direct value. Click to switch to environment variable."}
          </Tooltip>
        </TooltipTrigger>
      </Flex>
      {description && (
        <Text color="text-700" size="S">
          {description}
        </Text>
      )}
      <Flex direction="row" gap="size-100" alignItems="center">
        <View
          flex="1"
          paddingStart="size-100"
          paddingEnd="size-100"
          borderRadius="medium"
          borderColor={isEnvVar ? "purple-700" : "grey-500"}
          borderWidth="thin"
          backgroundColor={isEnvVar ? "purple-100" : "grey-100"}
        >
          <Input
            type={inputType}
            value={value}
            onChange={(e) => onChange(e.target.value, isEnvVar)}
            placeholder={effectivePlaceholder}
            css={css`
              width: 100%;
              border: none;
              background: transparent;
              padding: var(--ac-global-dimension-size-100);
            `}
          />
        </View>
        {!isEnvVar && isPassword && (
          <Button
            variant="default"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <Icon
              svg={
                showPassword ? <Icons.EyeOffOutline /> : <Icons.EyeOutline />
              }
            />
          </Button>
        )}
      </Flex>
      {isEnvVar && (
        <Flex
          direction="row"
          gap="size-50"
          alignItems="center"
          marginTop="size-50"
        >
          <Icon svg={<Icons.InfoOutline />} color="purple-900" />
          <Text size="S" color="purple-900">
            Using environment variable: <code>{value}</code>
          </Text>
        </Flex>
      )}
    </View>
  );
}
