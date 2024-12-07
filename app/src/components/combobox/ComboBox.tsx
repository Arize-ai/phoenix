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
  /**
   * The container to render the popover into. If not provided, the popover will be rendered in the body.
   * @default document.body
   */
  container?: HTMLElement;
  /**
   * The width of the combobox. If not provided, the combobox will be sized to fit its contents. with a minimum width of 200px.
   */
  width?: string;
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
    <AriaComboBox {...props} css={comboBoxCSS(props.width)} data-size={size}>
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
