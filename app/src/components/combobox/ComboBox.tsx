import React from "react";
import {
  Button,
  ComboBox as AriaComboBox,
  ComboBoxProps as AriaComboBoxProps,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  ListBoxItemProps as AriaListBoxItemProps,
  Popover,
  Text,
  ValidationResult,
} from "react-aria-components";

import { Icon, Icons } from "@arizeai/components";

import { comboBoxCSS, comboBoxItemCSS, comboBoxPopoverCSS } from "./styles";

export interface ComboBoxProps<T extends object>
  extends Omit<AriaComboBoxProps<T>, "children"> {
  /**
   * The label for the ComboBox. If this is omitted, an aria-label must be provided.
   * TODO: enforce this
   */
  label?: string;
  description?: string | null;
  errorMessage?: string | ((validation: ValidationResult) => string);
  children: React.ReactNode | ((item: T) => React.ReactNode);
}

export function ComboBox<T extends object>({
  label,
  description,
  errorMessage,
  children,
  ...props
}: ComboBoxProps<T>) {
  return (
    <AriaComboBox {...props} css={comboBoxCSS}>
      <Label>{label}</Label>
      <div className="px-combobox-container">
        <Input />
        <Button>
          <Icon svg={<Icons.ArrowIosDownwardOutline />} />
        </Button>
      </div>
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
      <Popover css={comboBoxPopoverCSS}>
        <ListBox>{children}</ListBox>
      </Popover>
    </AriaComboBox>
  );
}

export interface ListBoxItemProps<T = object>
  extends Omit<AriaListBoxItemProps<T>, "textValue"> {
  /** A string representation of the item's contents, used for features like typeahead. */
  textValue: string;
}

export function ComboBoxItem(props: ListBoxItemProps) {
  return (
    <ListBoxItem {...props} css={comboBoxItemCSS}>
      {({ isSelected }) => {
        return (
          <>
            {props.children}
            {isSelected && (
              <Icon
                svg={<Icons.CheckmarkOutline />}
                className="px-menu-item__selected-checkmark"
              />
            )}
          </>
        );
      }}
    </ListBoxItem>
  );
}
