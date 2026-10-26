import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Heading, Text } from "./content";
import { Token } from "./token";
import { Truncate } from "./utility/Truncate";
import { View } from "./view";

export type PageHeaderLabel = {
  id: string;
  name: string;
  color?: string | null;
};

export type PageHeaderProps = {
  /**
   * The title of the page header.
   */
  title: ReactNode;
  /**
   * Labels applied to the page's subject, shown on their own row beneath the
   * caption.
   */
  labels?: readonly PageHeaderLabel[];
  /**
   * A control for editing the labels, shown before them. When it is set and
   * there are no labels, the row reads "No labels".
   */
  labelAction?: ReactNode;
  /**
   * The subtitle of the page header, typically the subject's description.
   */
  subTitle?: ReactNode;
  /**
   * A secondary line between the title and the subtitle, such as where the
   * subject was cloned from.
   */
  caption?: ReactNode;
  /**
   * An icon leading the caption. It sits in a column as wide as an `S`
   * `IconButton`, so it lines up with one used as the `labelAction`.
   */
  captionVisual?: ReactNode;
  /**
   * The extra content of the page header.
   */
  extra?: ReactNode;
};

const pageHeaderContentCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: var(--global-dimension-size-100);
  align-items: center;
  .page-header__title {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
  }
  .page-header__extra {
    grid-column: 2;
    grid-row: 1;
  }
  .page-header__details {
    grid-column: 1 / -1;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-50);
    min-width: 0;
    &:empty {
      display: none;
    }
  }
  .page-header__caption {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-50);
    min-width: 0;
  }
  .page-header__caption-visual {
    flex: none;
    display: flex;
    justify-content: center;
    width: var(--global-button-height-s);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-700);
  }
  .page-header__labels {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .page-header__label-action {
    display: flex;
    margin-inline-end: calc(
      var(--global-dimension-size-50) - var(--global-dimension-size-100)
    );
  }
`;

const labelListCSS = css`
  display: contents;
`;

function Title({ children }: { children: ReactNode }) {
  if (typeof children === "string") {
    return <Heading level={1}>{children}</Heading>;
  }
  return children;
}

function SecondaryText({ children }: { children: ReactNode }) {
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

function Labels({ labels }: { labels: readonly PageHeaderLabel[] }) {
  return (
    <ul css={labelListCSS}>
      {labels.map((label) => (
        <li key={label.id}>
          <Token color={label.color ?? undefined}>
            <Truncate maxWidth={200} title={label.name}>
              {label.name}
            </Truncate>
          </Token>
        </li>
      ))}
    </ul>
  );
}

export function PageHeader({
  title,
  labels,
  labelAction,
  subTitle,
  caption,
  captionVisual,
  extra,
}: PageHeaderProps) {
  const hasLabels = labels != null && labels.length > 0;
  return (
    <View padding="size-200" flex="none" data-testid="page-header">
      <div css={pageHeaderContentCSS} data-testid="page-header-content">
        <div className="page-header__title">
          <Title>{title}</Title>
        </div>
        {extra && <div className="page-header__extra">{extra}</div>}
        <div className="page-header__details">
          {caption && captionVisual ? (
            <div className="page-header__caption">
              <span className="page-header__caption-visual">
                {captionVisual}
              </span>
              <SecondaryText>{caption}</SecondaryText>
            </div>
          ) : (
            <SecondaryText>{caption}</SecondaryText>
          )}
          {(labelAction || hasLabels) && (
            <div className="page-header__labels">
              {labelAction && (
                <span className="page-header__label-action">{labelAction}</span>
              )}
              {hasLabels ? (
                <Labels labels={labels} />
              ) : (
                <Text size="S" color="text-500">
                  No labels
                </Text>
              )}
            </div>
          )}
          <SecondaryText>{subTitle}</SecondaryText>
        </div>
      </div>
    </View>
  );
}
