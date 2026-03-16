import { css } from "@emotion/react";
import type { ReactNode } from "react";

import type { CopyItem } from "@phoenix/hooks/useMatchesWithCrumb";

import { Heading, Text } from "./content";
import { CopyMultiButton } from "./copy";
import { Flex } from "./layout";
import { LineClamp } from "./utility/LineClamp";
import { View } from "./view";

export type PageHeaderProps = {
  /**
   * The title of the page header.
   */
  title: ReactNode;
  /**
   * The subtitle of the page header.
   */
  subTitle?: ReactNode;
  /**
   * Copyable items shown in a menu when the copy button next to the title is
   * clicked. The button fades in on hover. Each item shows an icon based on
   * whether the name contains "id" or "name".
   */
  copyItems?: CopyItem[];
  /**
   * The extra content of the page header.
   */
  extra?: ReactNode;
};

const titleRowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;

  .page-header__copy {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-in-out;
  }

  &:hover .page-header__copy,
  .page-header__copy[data-copied],
  .page-header__copy:has([data-pressed]),
  .page-header__copy:focus-within {
    opacity: 1;
    pointer-events: auto;
  }
`;

function Title({ children }: { children: ReactNode }) {
  if (typeof children === "string") {
    return <Heading level={1}>{children}</Heading>;
  }
  return children;
}

function SubTitle({ children }: { children: ReactNode }) {
  if (!children) {
    return null;
  }
  if (typeof children === "string") {
    return (
      <LineClamp lines={2}>
        <Text size="S" color="text-700">
          {children}
        </Text>
      </LineClamp>
    );
  }
  return children;
}

export function PageHeader({
  title,
  subTitle,
  copyItems,
  extra,
}: PageHeaderProps) {
  return (
    <View padding="size-200" flex="none" data-testid="page-header">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        data-testid="page-header-content"
        gap="size-100"
      >
        <Flex direction="column" gap="size-50" minWidth={0}>
          <div css={titleRowCSS}>
            <Title>{title}</Title>
            {copyItems != null && copyItems.length > 0 && (
              <CopyMultiButton
                items={copyItems}
                size="S"
                className="page-header__copy"
              />
            )}
          </div>
          <SubTitle>{subTitle}</SubTitle>
        </Flex>
        {extra}
      </Flex>
    </View>
  );
}
