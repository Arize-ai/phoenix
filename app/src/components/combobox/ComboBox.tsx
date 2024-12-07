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

import { SizingProps } from "@phoenix/components/types";

import { comboBoxCSS, comboBoxItemCSS, comboBoxPopoverCSS } from "./styles";

export interface ComboBoxProps<T extends object>
  extends Omit<AriaComboBoxProps<T>, "children">,
    SizingProps {
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
  size = "M",
  ...props
}: ComboBoxProps<T>) {
  return (
    <AriaComboBox {...props} css={comboBoxCSS} data-size={size}>
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
