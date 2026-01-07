import React, { useState } from "react";
import { Key } from "react-aria-components";
import {
  Control,
  Controller,
  FieldValues,
  Path,
  UseFormSetValue,
} from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  ComboBox,
  ComboBoxItem,
  CompositeField,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  Popover,
  Select,
  SelectItem,
  SelectValue,
  Text,
  TextField,
} from "@phoenix/components";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";

type MappingMode = "path" | "literal";

interface PathOption {
  id: string;
  label: string;
}

export interface SwitchableEvaluatorInputProps<
  TFieldValues extends FieldValues,
> {
  /**
   * The field name used for both pathMapping and literalMapping
   * e.g. "text" results in "pathMapping.text" and "literalMapping.text"
   */
  fieldName: string;
  /**
   * The label shown above the input
   */
  label: string;
  /**
   * Optional description text shown below the input
   */
  description?: string;
  /**
   * The default mode for this field
   * @default "path"
   */
  defaultMode?: MappingMode;
  /**
   * react-hook-form control object
   */
  control: Control<TFieldValues>;
  /**
   * react-hook-form setValue function for clearing values on mode switch
   */
  setValue: UseFormSetValue<TFieldValues>;
  /**
   * Options for the path mode ComboBox
   */
  pathOptions: PathOption[];
  /**
   * Placeholder text for path mode
   */
  pathPlaceholder?: string;
  /**
   * Placeholder text for literal mode
   */
  literalPlaceholder?: string;
  /**
   * Current value for path mode (used for controlled input display)
   */
  pathInputValue?: string;
  /**
   * Callback when path input value changes
   */
  onPathInputChange?: (value: string) => void;
}

const modeSelectCSS = css`
  // Make the select compact
  width: auto;
  min-width: 90px;

  button {
    min-width: 90px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
`;

const inputContainerCSS = css`
  flex: 1;
  min-width: 0;

  // ComboBox adjustments within composite field (middle element)
  .px-combobox-container {
    min-width: 0 !important;
    input {
      min-width: 0 !important;
      border-radius: 0;
    }
  }

  // TextField adjustments within composite field (middle element)
  .ac-textfield {
    .react-aria-Input {
      border-radius: 0;
    }
    input {
      border-radius: 0;
    }
  }
`;

const clearButtonCSS = css`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
`;

const MODE_OPTIONS: Array<{ id: MappingMode; label: string }> = [
  { id: "path", label: "Path" },
  { id: "literal", label: "Literal" },
];

export function SwitchableEvaluatorInput<TFieldValues extends FieldValues>({
  fieldName,
  label,
  description,
  defaultMode = "path",
  control,
  setValue,
  pathOptions,
  pathPlaceholder = "Select a field path",
  literalPlaceholder = "Enter a value",
  pathInputValue,
  onPathInputChange,
}: SwitchableEvaluatorInputProps<TFieldValues>) {
  const [mode, setMode] = useState<MappingMode>(defaultMode);

  const pathFieldName = `pathMapping.${fieldName}` as Path<TFieldValues>;
  const literalFieldName = `literalMapping.${fieldName}` as Path<TFieldValues>;

  const handleModeChange = (key: Key | Key[] | null) => {
    if (key && (key === "path" || key === "literal")) {
      const newMode = key as MappingMode;
      // Clear the previous mode's value before switching
      if (newMode === "path") {
        // Switching to path mode, clear the literal value
        setValue(
          literalFieldName,
          undefined as TFieldValues[typeof literalFieldName]
        );
      } else {
        // Switching to literal mode, clear the path value
        setValue(
          pathFieldName,
          undefined as TFieldValues[typeof pathFieldName]
        );
        onPathInputChange?.("");
      }
      setMode(newMode);
    }
  };

  const handleClear = () => {
    if (mode === "path") {
      setValue(pathFieldName, undefined as TFieldValues[typeof pathFieldName]);
      onPathInputChange?.("");
    } else {
      setValue(
        literalFieldName,
        undefined as TFieldValues[typeof literalFieldName]
      );
    }
  };

  return (
    <Flex direction="column" gap="size-75">
      <Label htmlFor={`${fieldName}-mode`}>{label}</Label>
      <CompositeField>
        <Select
          aria-label={`Select input mode for ${label}`}
          value={mode}
          onChange={handleModeChange}
          css={modeSelectCSS}
          size="M"
        >
          <Button className="left-child" size="M" id={`${fieldName}-mode`}>
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover offset={0}>
            <ListBox>
              {MODE_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} id={opt.id} textValue={opt.label}>
                  {opt.label}
                </SelectItem>
              ))}
            </ListBox>
          </Popover>
        </Select>

        <div css={inputContainerCSS}>
          {mode === "path" ? (
            <Controller
              name={pathFieldName}
              control={control}
              render={({ field }) => (
                <ComboBox
                  aria-label={`${label} path mapping`}
                  placeholder={pathPlaceholder}
                  defaultItems={pathOptions}
                  selectedKey={field.value ?? ""}
                  size="L"
                  id={`${fieldName}-path`}
                  allowsCustomValue
                  onSelectionChange={(key) => {
                    field.onChange(key);
                    onPathInputChange?.(key as string);
                  }}
                  onInputChange={(value) => {
                    field.onChange(value);
                    onPathInputChange?.(value);
                  }}
                  inputValue={pathInputValue ?? (field.value as string) ?? ""}
                >
                  {(item) => (
                    <ComboBoxItem
                      key={item.id}
                      id={item.id}
                      textValue={item.id}
                    >
                      {item.label}
                    </ComboBoxItem>
                  )}
                </ComboBox>
              )}
            />
          ) : (
            <Controller
              name={literalFieldName}
              control={control}
              render={({ field }) => (
                <TextField
                  aria-label={`${label} literal value`}
                  {...field}
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  size="M"
                >
                  <Input placeholder={literalPlaceholder} />
                </TextField>
              )}
            />
          )}
        </div>
        <Button
          aria-label={`Clear ${label}`}
          className="right-child"
          size="M"
          onPress={handleClear}
          css={clearButtonCSS}
          leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
        />
      </CompositeField>
      {description && (
        <Text color="text-500" size="S">
          {description}
        </Text>
      )}
    </Flex>
  );
}
