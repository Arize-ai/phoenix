import { css } from "@emotion/react";
import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { Children, Fragment, isValidElement } from "react";
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

import { useCollapsibleContent } from "@phoenix/components/core/contexts/CollapsibleContentContext";
import { classNames } from "@phoenix/utils/classNames";

import { Icon, Icons } from "../icon";
import { Flex } from "../layout";
import type { FlexStyleProps, SizingProps, StylableProps } from "../types";
import { disclosureCSS, disclosureGroupCSS } from "./styles";

export type DisclosureGroupProps = AriaDisclosureGroupProps &
  StylableProps &
  SizingProps;

function getDisclosureKeys(children: ReactNode) {
  const disclosureKeys: Array<string | number> = [];

  Children.forEach(children, (child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        id?: string | number;
      }>(child)
    ) {
      return;
    }
    if (child.type === Fragment) {
      disclosureKeys.push(...getDisclosureKeys(child.props.children));
    } else if (child.props.id != null) {
      disclosureKeys.push(child.props.id);
    }
  });

  return disclosureKeys;
}

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
  children,
  defaultExpandedKeys,
  ...props
}: DisclosureGroupProps) => {
  const { actionVersion, expansionAction } = useCollapsibleContent();
  const nextDefaultExpandedKeys =
    expansionAction === "collapse"
      ? []
      : expansionAction === "expand"
        ? getDisclosureKeys(children)
        : defaultExpandedKeys;
  return (
    <AriaDisclosureGroup
      key={actionVersion}
      allowsMultipleExpanded
      className={classNames("disclosure-group", className)}
      css={css(disclosureGroupCSS, propCSS)}
      data-size={size}
      {...props}
      defaultExpandedKeys={nextDefaultExpandedKeys}
    >
      {children}
    </AriaDisclosureGroup>
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
      className={classNames("disclosure", className)}
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
        {arrowPosition !== "none" ? (
          <Icon svg={<Icons.ChevronRightSmall />} />
        ) : null}
      </Button>
    </Heading>
  );
};
