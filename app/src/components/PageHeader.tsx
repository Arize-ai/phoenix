import { type ReactNode } from "react";

import { Heading, Text } from "./content";
import { Flex } from "./layout";
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
   * The extra content of the page header.
   */
  extra?: ReactNode;
};

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
      <Text size="S" color="text-700">
        {children}
      </Text>
    );
  }
  return children;
}

export function PageHeader({ title, subTitle, extra }: PageHeaderProps) {
  return (
    <View padding="size-200" flex="none" data-testid="page-header">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        data-testid="page-header-content"
      >
        <Flex direction="column" gap="size-50">
          <Title>{title}</Title>
          <SubTitle>{subTitle}</SubTitle>
        </Flex>
        {extra}
      </Flex>
    </View>
  );
}
