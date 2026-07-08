import type { ReactNode } from "react";

import { Heading } from "@phoenix/components/core/content";
import { CopyToClipboardButton } from "@phoenix/components/core/copy";
import { Flex } from "@phoenix/components/core/layout";

import { IDBadge } from "./IDBadge";

interface TitleWithIDProps {
  /**
   * The title content to display.
   */
  title: ReactNode;
  /**
   * The ID value to display in a badge alongside the title.
   */
  id: string;
}

export const TitleWithID = ({ title, id }: TitleWithIDProps) => {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Heading>{title}</Heading>
      <IDBadge size="S" id={id} />
      <CopyToClipboardButton variant="quiet" size="S" text={id} />
    </Flex>
  );
};
