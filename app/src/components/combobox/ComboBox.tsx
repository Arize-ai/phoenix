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

import { SizingProps } from "@phoenix/components/types";

import { comboBoxCSS, comboBoxItemCSS, comboBoxPopoverCSS } from "./styles";

export interface ComboBoxProps<T extends object>
  extends Omit<AriaComboBoxProps<T>, "children">,
    SizingProps {
  label?: string;
  placeholder?: string;
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
  /**
   * If true, click and keypress events will not propagate to the parent element.
   *
   * This is useful when nesting the combobox within containers that have onClick handlers,
   * but should be used sparingly.
   */
  stopPropagation?: boolean;
}

/**
 * Prevents the event from propagating to the parent element.
 */
const stopPropagationHandler = (e: React.MouseEvent | React.KeyboardEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export function ComboBox<T extends object>({
  label,
  placeholder,
  description,
  errorMessage,
  children,
  container,
  size = "M",
  width,
  stopPropagation,
  ...props
}: ComboBoxProps<T>) {
  return (
    <AriaComboBox
      {...props}
      css={comboBoxCSS}
      data-size={size}
      style={{
        width,
      }}
    >
      {label && <Label>{label}</Label>}
      <div
        className="px-combobox-container"
        // Prevent interactions with the combobox components from propagating above this element
        // This allows us to nest the combobox within containers that have onClick handlers
        onClick={stopPropagation ? stopPropagationHandler : undefined}
        onKeyDown={stopPropagation ? stopPropagationHandler : undefined}
        onKeyUp={stopPropagation ? stopPropagationHandler : undefined}
      >
        <Input placeholder={placeholder} />
        <Button>
          <Icon svg={<Icons.ArrowIosDownwardOutline />} />
        </Button>
      </div>
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
      <Popover css={comboBoxPopoverCSS} UNSTABLE_portalContainer={container}>
        <ListBox>{children}</ListBox>
      </Popover>
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
  const { children, ...rest } = props;
  return (
    <ListBoxItem {...rest} css={comboBoxItemCSS}>
      {({ isSelected }) => {
        return (
          <>
            {children}
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
