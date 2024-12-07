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
import { css } from "@emotion/react";

import { Icon, Icons } from "@arizeai/components";

import { comboBoxCSS, comboBoxItemCSS, comboBoxPopoverCSS } from "./styles";

export interface ComboBoxProps<T extends object>
  extends Omit<AriaComboBoxProps<T>, "children"> {
  label: string;
  description?: string | null;
  errorMessage?: string | ((validation: ValidationResult) => string);
  children: React.ReactNode | ((item: T) => React.ReactNode);
  container?: HTMLElement;
}

export function ComboBox<T extends object>({
  label,
  description,
  errorMessage,
  children,
  container,
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
      <Popover css={comboBoxPopoverCSS} UNSTABLE_portalContainer={container}>
        <ListBox>{children}</ListBox>
      </Popover>
      <div
        id="popover-container"
        css={css`
          display: hidden;
        `}
      />
    </AriaComboBox>
  );
}

export interface ListBoxItemProps<T = object>
  extends Omit<AriaListBoxItemProps<T>, "textValue"> {
  /**
   * A string representation of the item's contents, used for features like typeahead.
   **/
  textValue: string;
}

export function ComboBoxItem(props: ListBoxItemProps) {
  return (
    // <div onClick={(e) => e.stopPropagation()}>
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
    // </div>
  );
}
