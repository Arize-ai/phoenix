import React, { PropsWithChildren } from "react";
import {
  Button,
  Disclosure as AriaDisclosure,
  DisclosureGroup as AriaDisclosureGroup,
  type DisclosureGroupProps as AriaDisclosureGroupProps,
  DisclosurePanel as AriaDisclosurePanel,
  type DisclosurePanelProps as AriaDisclosurePanelProps,
  type DisclosureProps as AriaDisclosureProps,
  Heading,
} from "react-aria-components";

import { classNames, Flex, Icon, Icons } from "@phoenix/components";

import { FlexStyleProps, SizingProps } from "../types";

import { disclosureCSS, disclosureGroupCSS } from "./styles";

export type DisclosureGroupProps = AriaDisclosureGroupProps;

/**
 * Wrap multiple Disclosure components in a DisclosureGroup to control
 * the expanded state of the items more easily.
 *
 * AKA Accordion with one or more items
 */
export const DisclosureGroup = ({
  className,
  ...props
}: DisclosureGroupProps) => {
  return (
    <AriaDisclosureGroup
      allowsMultipleExpanded
      className={classNames("ac-disclosure-group", className)}
      css={disclosureGroupCSS}
      {...props}
    />
  );
};

export type DisclosureProps = AriaDisclosureProps & SizingProps;

/**
 * A Disclosure is a component that allows for a single item to be expanded.
 *
 * AKA Accordion (with a single item) / Accordion Item
 */
export const Disclosure = ({ size, className, ...props }: DisclosureProps) => {
  return (
    <AriaDisclosure
      className={classNames("ac-disclosure", className)}
      css={disclosureCSS}
      data-size={size}
      defaultExpanded
      {...props}
    />
  );
};

export type DisclosurePanelProps = AriaDisclosurePanelProps;

/**
 * A DisclosurePanel is a component that contains the content of a Disclosure.
 *
 * AKA Accordion Content
 */
export const DisclosurePanel = ({
  className,
  ...props
}: DisclosurePanelProps) => {
  return (
    <AriaDisclosurePanel
      className={classNames("ac-disclosure-panel", className)}
      {...props}
    />
  );
};

export type DisclosureTriggerProps = PropsWithChildren<{
  arrowPosition?: "start" | "end";
  justifyContent?: FlexStyleProps["justifyContent"];
}>;

/**
 * A DisclosureTrigger is a component that triggers the Disclosure.
 *
 * AKA Accordion Title
 */
export const DisclosureTrigger = ({
  children,
  arrowPosition,
  justifyContent,
}: DisclosureTriggerProps) => {
  return (
    <Heading>
      <Button slot="trigger" data-arrow-position={arrowPosition}>
        <Flex
          justifyContent={justifyContent}
          alignItems="center"
          width="100%"
          gap="size-100"
        >
          {children}
        </Flex>
        <Icon svg={<Icons.ArrowIosForwardOutline />} />
      </Button>
    </Heading>
  );
};
