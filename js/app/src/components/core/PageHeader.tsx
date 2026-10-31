import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useRef } from "react";

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
   * subtitle.
   */
  labels?: readonly PageHeaderLabel[];
  /**
   * A control for editing the labels, shown before them. When it is set and
   * there are no labels, the row reads "No labels", and pressing that text
   * presses the control.
   */
  labelAction?: ReactNode;
  /**
   * The subtitle of the page header, typically the subject's description.
   */
  subTitle?: ReactNode;
  /**
   * A secondary line directly beneath the title, such as where the subject
   * was cloned from. It shares the title's cell, so the page-level actions in
   * `extra` stay beside the title and the caption.
   */
  caption?: ReactNode;
  /**
   * The extra content of the page header.
   */
  extra?: ReactNode;
};

const pageHeaderContentCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: var(--global-dimension-size-100);
  row-gap: var(--global-dimension-size-100);
  align-items: center;
  .page-header__title {
    grid-column: 1;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .page-header__caption {
    /* The level 1 heading's 36px line box leaves 6px of leading below its
    glyphs; pull the caption up into it so the two read as one unit. */
    margin-block-start: calc(-1 * var(--global-dimension-size-25));
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
  .page-header__subtitle {
    max-inline-size: var(--global-line-length-max);
  }
  .page-header__labels {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .page-header__labels-empty {
    cursor: pointer;
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
  extra,
}: PageHeaderProps) {
  const hasLabels = labels != null && labels.length > 0;
  const labelActionRef = useRef<HTMLSpanElement>(null);
  return (
    <View padding="size-200" flex="none" data-testid="page-header">
      <div css={pageHeaderContentCSS} data-testid="page-header-content">
        <div className="page-header__title">
          <Title>{title}</Title>
          {caption && (
            <div className="page-header__caption">
              <SecondaryText>{caption}</SecondaryText>
            </div>
          )}
        </div>
        {extra && <div className="page-header__extra">{extra}</div>}
        <div className="page-header__details">
          {subTitle && (
            <div className="page-header__subtitle">
              <SecondaryText>{subTitle}</SecondaryText>
            </div>
          )}
          {(labelAction || hasLabels) && (
            <div className="page-header__labels">
              {labelAction && (
                <span
                  className="page-header__label-action"
                  ref={labelActionRef}
                >
                  {labelAction}
                </span>
              )}
              {hasLabels ? (
                <Labels labels={labels} />
              ) : (
                // React Aria treats element.click() as a virtual press
                <span
                  className="page-header__labels-empty"
                  onClick={() =>
                    labelActionRef.current?.querySelector("button")?.click()
                  }
                >
                  <Text size="S" color="text-500">
                    No labels
                  </Text>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </View>
  );
}
