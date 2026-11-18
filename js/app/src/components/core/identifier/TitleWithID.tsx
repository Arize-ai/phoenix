import type { ReactNode } from "react";

import { Heading, Text } from "@phoenix/components/core/content";
import { Flex } from "@phoenix/components/core/layout";

import { Identifier } from "./Identifier";

interface TitleWithIDProps {
  /**
   * The title content to display.
   */
  title: ReactNode;
  /**
   * The ID of the titled thing, shown as a copyable `Identifier` beside the
   * title.
   */
  id: string;
}

export const TitleWithID = ({ title, id }: TitleWithIDProps) => {
  return (
    <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
      <Heading>{title}</Heading>
      <Text size="S" color="text-700" minWidth={0}>
        <Identifier value={id} copyNoun="ID" />
      </Text>
    </Flex>
  );
};
