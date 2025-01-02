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

import { Icon, Icons } from "@phoenix/components";

import { disclosureCss, disclosureGroupCss } from "./styles";

export type DisclosureGroupProps = AriaDisclosureGroupProps;

/**
 * Wrap multiple Disclosure components in a DisclosureGroup to control
 * the expanded state of the items more easily.
 *
 * AKA Accordion with one or more items
 */
export const DisclosureGroup = (props: DisclosureGroupProps) => {
  return <AriaDisclosureGroup css={disclosureGroupCss} {...props} />;
};

export type DisclosureProps = AriaDisclosureProps;

/**
 * A Disclosure is a component that allows for a single item to be expanded.
 *
 * AKA Accordion (with a single item) / Accordion Item
 */
export const Disclosure = (props: DisclosureProps) => {
  return <AriaDisclosure css={disclosureCss} {...props} />;
};

export type DisclosurePanelProps = AriaDisclosurePanelProps;

/**
 * A DisclosurePanel is a component that contains the content of a Disclosure.
 *
 * AKA Accordion Content
 */
export const DisclosurePanel = (props: DisclosurePanelProps) => {
  return <AriaDisclosurePanel {...props} />;
};

/**
 * A DisclosureTrigger is a component that triggers the Disclosure.
 *
 * AKA Accordion Title
 */
export const DisclosureTrigger = ({ children }: PropsWithChildren) => {
  return (
    <Heading>
      <Button slot="trigger">
        {children}
        <Icon svg={<Icons.ArrowIosForwardOutline />} />
      </Button>
    </Heading>
  );
};
