import { ComponentProps, ReactNode, Ref, useState } from "react";
import {
  GridList as AriaGridList,
  GridListHeader,
  GridListItem as AriaGridListItem,
  GridListItemProps as AriaGridListItemProps,
  GridListProps as AriaGridListProps,
  GridListSection as AriaGridListSection,
} from "react-aria-components";
import { css } from "@emotion/react";

import { Checkbox } from "@phoenix/components/checkbox";
import { Text } from "@phoenix/components/content";
import {
  gridListCss,
  gridListItemCss,
  gridListSectionTitleCss,
} from "@phoenix/components/gridlist/styles";
import { Flex } from "@phoenix/components/layout";

import { StylableProps } from "../types";

export interface GridListProps<T> extends AriaGridListProps<T>, StylableProps {
  ref?: Ref<HTMLDivElement>;
}

export interface GridListItemProps
  extends Omit<AriaGridListItemProps, "children">,
    StylableProps {
  children: ReactNode;
  subtitle?: ReactNode;
  trailingContent?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * GridList is similar to Menu, but allows for interactive content within the list items.
 * @see https://react-spectrum.adobe.com/react-aria/GridList.html
 * @example
 * <GridList>
 *   <GridListItem>Item 1</GridListItem>
 *   <GridListItem>Item 2</GridListItem>
 *   <GridListItem>Item 3</GridListItem>
 * </GridList>
 */
export function GridList<T extends object>(props: GridListProps<T>) {
  const { ref, ...restProps } = props;
  return <AriaGridList css={gridListCss} ref={ref} {...restProps} />;
}

export function GridListItem(props: GridListItemProps) {
  const { ref, children, subtitle, trailingContent, ...restProps } = props;
  return (
    <AriaGridListItem css={gridListItemCss} ref={ref} {...restProps}>
      {({ selectionMode, selectionBehavior }) => (
        <>
          <GridListItemContent
            subtitle={subtitle}
            selectionMode={selectionMode}
            selectionBehavior={selectionBehavior}
          >
            {children}
          </GridListItemContent>
          {trailingContent}
        </>
      )}
    </AriaGridListItem>
  );
}

const GridListItemContent = ({
  children,
  subtitle,
  selectionMode,
  selectionBehavior,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
  selectionMode?: ComponentProps<typeof GridList>["selectionMode"];
  selectionBehavior?: ComponentProps<typeof GridList>["selectionBehavior"];
}) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      css={css`
        flex: 1;
        min-width: 0;
      `}
    >
      <Flex
        direction="row"
        alignItems="center"
        gap="size-100"
        className="GridListItem__content"
      >
        {selectionMode === "multiple" && selectionBehavior === "toggle" && (
          <Checkbox slot="selection" isHovered={isHovered} />
        )}
        <Flex
          direction="column"
          gap="var(--ac-global-dimension-static-size-25)"
          minWidth={0}
          flex={1}
          css={css`
            padding: var(--ac-global-menu-item-gap);
          `}
        >
          {children}
          {subtitle}
        </Flex>
      </Flex>
    </div>
  );
};

/**
 * GridListSectionTitle is the title for the grid list section, and should
 * be used in conjunction with GridListSection.
 * @example
 * <GridListSection>
 *   <GridListSectionTitle title="Section 1" />
 *   <GridListItem>Item 1</GridListItem>
 *   <GridListItem>Item 2</GridListItem>
 *   <GridListItem>Item 3</GridListItem>
 * </GridListSection>
 */
export const GridListSectionTitle = ({ title }: { title: string }) => {
  return (
    <GridListHeader css={gridListSectionTitleCss}>
      <Text weight="heavy">{title}</Text>
    </GridListHeader>
  );
};

export const GridListSection = AriaGridListSection;
