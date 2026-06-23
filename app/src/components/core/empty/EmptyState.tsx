import { css } from "@emotion/react";
import { Fragment } from "react";
import type { ReactNode } from "react";

import { Button, ExternalLinkButton } from "@phoenix/components/core/button";
import type { ButtonProps } from "@phoenix/components/core/button/types";
import { Text } from "@phoenix/components/core/content";
import { Flex } from "@phoenix/components/core/layout";

import { LinkCard } from "./LinkCard";
import type { LinkCardProps } from "./LinkCard";

export type EmptyStateCardItem = LinkCardProps;

/**
 * A single item in an action strip. Convention: use `link` for external
 * destinations (rendered as an `ExternalLink`) and `button` for in-product
 * behaviors — navigation, opening a dialog, etc. (rendered as a `Button`).
 *
 * `node` is the escape hatch for a self-contained interactive control the
 * `link`/`button` kinds can't express — e.g. a button that opens a popover menu
 * (`RunDatasetExperimentButton`). It renders verbatim in the strip row; size it
 * to `S` so it sits flush with the other items.
 */
export type EmptyStateActionItem =
  | { kind: "link"; label: string; href: string }
  | { kind: "node"; node: ReactNode }
  | ({ kind: "button" } & Omit<ButtonProps, "size">);

export type EmptyStateAction =
  | { type: "strip"; items: EmptyStateActionItem[] }
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

const actionCardsCSS = css`
  display: grid;
  gap: var(--global-dimension-size-200);
  width: min(100%, var(--global-dimension-size-4000));
`;

const actionCardsTwoColumnCSS = css`
  width: min(100%, calc(var(--global-dimension-size-4000) * 2));
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, var(--global-dimension-size-4000)), 1fr)
  );
`;

function ActionArea({ action }: { action: EmptyStateAction }) {
  if (action.type === "strip") {
    return (
      <Flex direction="row" gap="size-100" wrap alignItems="center">
        {action.items.map((item, i) => {
          if (item.kind === "link") {
            // Rendered as a quiet (borderless, transparent) link-button so it
            // sits in the strip with the same padding/height as real buttons
            // instead of crowding them as a bare inline link would.
            return (
              <ExternalLinkButton
                key={i}
                href={item.href}
                variant="quiet"
                size="S"
              >
                {item.label}
              </ExternalLinkButton>
            );
          }
          if (item.kind === "node") {
            return <Fragment key={i}>{item.node}</Fragment>;
          }
          const { kind: _kind, ...btnProps } = item;
          return <Button key={i} size="S" {...btnProps} />;
        })}
      </Flex>
    );
  }

  // cards
  const cols = action.columns ?? 1;
  return (
    <div
      css={[
        actionCardsCSS,
        cols === 2 && actionCardsTwoColumnCSS,
        cols === 1 &&
          css`
            grid-template-columns: 1fr;
          `,
      ]}
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

  // Cards are a heavier block than a button/link row, so set them further apart
  // from the text/graphic above than a simple action would be. In the
  // horizontal layout the graphic sits beside the text, making that block
  // heavier still, so the cards want a bit more room than in the vertical case.
  const actionGap = action?.type === "cards" ? "size-300" : "size-200";
  const horizontalActionGap =
    action?.type === "cards" ? "size-500" : "size-200";

  const textBlock =
    title != null || description != null ? (
      <Flex direction="column" gap="size-25" alignItems="center">
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
      <Flex direction="column" gap={horizontalActionGap} alignItems="center">
        <Flex
          direction="row"
          wrap
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
      {/* Keep the action close to the text (closer than the graphic sits),
          but give the heavier cards block a bit more room — see actionGap. */}
      <Flex direction="column" gap={actionGap} alignItems="center">
        {textBlock}
        {action != null && <ActionArea action={action} />}
      </Flex>
    </Flex>
  );
}
