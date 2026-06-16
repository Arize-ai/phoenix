import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Button, Flex, Text } from "@phoenix/components/core";
import type { ButtonProps } from "@phoenix/components/core/button/types";
import { ExternalLink } from "@phoenix/components/core/ExternalLink";

import { LinkCard } from "./LinkCard";
import type { LinkCardProps } from "./LinkCard";

export type EmptyStateCardItem = LinkCardProps;

export type EmptyStateAction =
  | { type: "link"; label: string; href: string }
  | { type: "buttons"; buttons: Omit<ButtonProps, "size">[] }
  | { type: "cards"; items: EmptyStateCardItem[]; columns?: 1 | 2 };

type EmptyStateBaseProps = {
  graphic?: ReactNode;
  action?: EmptyStateAction;
  /**
   * Controls whether the graphic appears to the left of the content.
   * "auto" switches to horizontal when cards action uses 2 columns with 3+ items.
   * @default "auto"
   */
  orientation?: "auto" | "vertical" | "horizontal";
};

/**
 * Title always requires description — title-only is not a valid empty state.
 */
export type EmptyStateProps = EmptyStateBaseProps &
  (
    | { title: string; description: ReactNode }
    | { title?: never; description?: ReactNode }
  );

function isHorizontal(
  orientation: "auto" | "vertical" | "horizontal",
  action: EmptyStateAction | undefined,
  graphic: ReactNode | undefined
): boolean {
  if (graphic == null) return false;
  if (orientation === "horizontal") return true;
  if (orientation === "vertical") return false;
  return (
    action?.type === "cards" &&
    (action.columns ?? 1) === 2 &&
    action.items.length >= 3
  );
}

const descriptionCSS = css`
  max-width: var(--global-dimension-size-4000);
  text-align: center;
  text-wrap: balance;
`;

function ActionArea({ action }: { action: EmptyStateAction }) {
  if (action.type === "link") {
    return <ExternalLink href={action.href}>{action.label}</ExternalLink>;
  }

  if (action.type === "buttons") {
    return (
      <Flex direction="row" gap="size-100" wrap>
        {action.buttons.map((btnProps, i) => (
          <Button key={i} size="S" {...btnProps} />
        ))}
      </Flex>
    );
  }

  // cards
  const cols = action.columns ?? 1;
  return (
    <div
      css={
        cols === 1
          ? css`
              display: grid;
              gap: var(--global-dimension-size-200);
              grid-template-columns: 1fr;
              width: var(--global-dimension-size-4000);
            `
          : css`
              display: grid;
              gap: var(--global-dimension-size-200);
              grid-template-columns: repeat(
                2,
                var(--global-dimension-size-4000)
              );
              width: fit-content;
            `
      }
    >
      {action.items.map((item, i) => (
        <LinkCard key={i} {...item} />
      ))}
    </div>
  );
}

export function EmptyState({
  graphic,
  title,
  description,
  action,
  orientation = "auto",
}: EmptyStateProps) {
  const horizontal = isHorizontal(orientation, action, graphic);

  const textBlock =
    title != null || description != null ? (
      <Flex direction="column" gap="size-100" alignItems="center">
        {title != null && (
          <Text size="L" weight="heavy">
            {title}
          </Text>
        )}
        {description != null && (
          <Text size="S" color="text-700" css={descriptionCSS}>
            {description}
          </Text>
        )}
      </Flex>
    ) : null;

  if (horizontal) {
    return (
      <Flex direction="column" gap="size-400" alignItems="center">
        <Flex
          direction="row"
          gap="size-400"
          alignItems="center"
          justifyContent="center"
        >
          <Flex alignItems="center" justifyContent="center">
            {graphic}
          </Flex>
          {textBlock}
        </Flex>
        {action != null && <ActionArea action={action} />}
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      gap="size-300"
      alignItems="center"
      justifyContent="center"
    >
      {graphic != null && graphic}
      {textBlock}
      {action != null && <ActionArea action={action} />}
    </Flex>
  );
}
