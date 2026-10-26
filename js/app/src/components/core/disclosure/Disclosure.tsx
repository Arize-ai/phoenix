import { css } from "@emotion/react";
import type { CSSProperties, PropsWithChildren } from "react";
import { createContext, useContext } from "react";
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

import { classNames } from "@phoenix/utils/classNames";

import { Text } from "../content";
import { Icon, Icons } from "../icon";
import { Flex } from "../layout";
import type { FlexStyleProps, SizingProps, StylableProps } from "../types";
import { disclosureCSS, disclosureGroupCSS } from "./styles";

export type DisclosureGroupProps = AriaDisclosureGroupProps &
  StylableProps &
  SizingProps;

/**
 * Wrap multiple Disclosure components in a DisclosureGroup to control
 * the expanded state of the items more easily.
 *
 * AKA Accordion with one or more items
 */
export const DisclosureGroup = ({
  className,
  css: propCSS,
  size,
  ...props
}: DisclosureGroupProps) => {
  return (
    <AriaDisclosureGroup
      allowsMultipleExpanded
      className={classNames("disclosure-group", className)}
      css={css(disclosureGroupCSS, propCSS)}
      data-size={size}
      {...props}
    />
  );
};

export type DisclosureProps = AriaDisclosureProps &
  SizingProps & {
    /**
     * The section has no content. It cannot be expanded, and its trigger
     * says "None" where the arrow would be.
     */
    isEmpty?: boolean;
  };

const DisclosureEmptyContext = createContext(false);

/**
 * A Disclosure is a component that allows for a single item to be expanded.
 *
 * AKA Accordion (with a single item) / Accordion Item
 */
export const Disclosure = ({
  size,
  className,
  isEmpty = false,
  ...props
}: DisclosureProps) => {
  return (
    <DisclosureEmptyContext.Provider value={isEmpty}>
      <AriaDisclosure
        className={classNames("disclosure", className)}
        css={disclosureCSS}
        data-size={size}
        data-empty={isEmpty || undefined}
        defaultExpanded
        {...props}
        // a group derives expansion from its keys rather than isExpanded, so
        // an empty item drops its id to stay out of the group's expanded keys
        {...(isEmpty
          ? { id: undefined, isDisabled: true, isExpanded: false }
          : null)}
      />
    </DisclosureEmptyContext.Provider>
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
      className={classNames("disclosure__panel", className)}
      {...props}
    />
  );
};

export type DisclosureTriggerProps = PropsWithChildren<{
  arrowPosition?: "start" | "end" | "none";
  justifyContent?: FlexStyleProps["justifyContent"];
  alignItems?: FlexStyleProps["alignItems"];
  direction?: FlexStyleProps["direction"];
  asHeading?: boolean;
  width?: CSSProperties["width"];
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
  alignItems = "center",
  direction = "row",
  width,
}: DisclosureTriggerProps) => {
  const isEmpty = useContext(DisclosureEmptyContext);
  return (
    <Heading className="react-aria-Heading disclosure__trigger">
      <Button
        slot="trigger"
        data-arrow-position={arrowPosition}
        style={{ width }}
      >
        <Flex
          justifyContent={justifyContent}
          direction={direction}
          alignItems={alignItems}
          width="100%"
          gap={direction === "row" ? "size-100" : "size-50"}
        >
          {children}
        </Flex>
        {isEmpty ? (
          <Text className="disclosure__empty-label" color="text-300">
            None
          </Text>
        ) : arrowPosition !== "none" ? (
          <Icon svg={<Icons.ChevronRightSmall />} />
        ) : null}
      </Button>
    </Heading>
  );
};
