import { forwardRef, PropsWithChildren, Ref } from "react";
import { css } from "@emotion/react";

import { Card as OldCard } from "@arizeai/components";

import { Button, Heading } from "@phoenix/components";
import { ViewStyleProps } from "@phoenix/components/types";
import { useStyleProps, viewStyleProps } from "@phoenix/components/utils";

type CardVariant = "default" | "compact";

interface CardProps extends PropsWithChildren<ViewStyleProps> {
  title: string;
  subTitle?: string;
  variant?: CardVariant;
  collapsible?: boolean;
  bodyStyle?: ViewStyleProps;
  useOldComponent?: boolean; // TODO: delete
}

const cardCSS = css`
  --scope-border-color: var(--ac-global-border-color-default);
  --card-header-height: 68px;

  &[data-variant="compact"] {
    --card-header-height: 46px;
  }

  display: flex;
  flex-direction: column;
  background-color: var(--ac-global-background-color-dark);
  color: var(--ac-global-text-color-900);
  border-radius: var(--ac-global-rounding-medium);
  border: 1px solid var(--scope-border-color);
  overflow: hidden;
`;

const cardHeaderCSS = css`
  display: flex;
  flex-direction: row;
  flex: none;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--ac-global-dimension-static-size-200);
  height: var(--card-header-height);
  transition: background-color 0.2s ease-in-out;
  border-bottom: 1px solid var(--scope-border-color);

  &[data-collapsible="true"] {
    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }
`;

const collapsibleHeadingCSS = css`
  width: 100%;
  height: 100%;
`;

const collapsibleButtonCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  text-align: left;
  width: 100%;
  height: 100%;
  appearance: none;
  background-color: inherit;
  cursor: pointer;
  padding: 0;
  border: 0;
  outline: none;
  color: var(--ac-global-text-color-900);
`;

const cardBodyCSS = css`
  flex: 1 1 auto;
  padding: var(--ac-global-dimension-static-size-200);
`;

function Card(
  {
    title,
    subTitle,
    children,
    variant = "default",
    collapsible = false,
    useOldComponent = false,
    bodyStyle = {},
    ...otherProps
  }: CardProps,
  ref: Ref<HTMLElement>
) {
  const { styleProps } = useStyleProps(otherProps, viewStyleProps);
  const { styleProps: bodyStyleProps } = useStyleProps(
    bodyStyle,
    viewStyleProps
  );
  if (useOldComponent) {
    return (
      <OldCard title={title} {...styleProps}>
        {children}
      </OldCard>
    );
  }
  const headingContents = (
    <>
      <Heading
        level={3}
        weight="heavy"
        css={collapsible ? collapsibleHeadingCSS : undefined}
      >
        {title}
      </Heading>
      {subTitle && <Heading level={4}>{subTitle}</Heading>}
    </>
  );
  return (
    <section
      ref={ref}
      css={cardCSS}
      data-variant={variant}
      style={styleProps.style}
    >
      <header css={cardHeaderCSS} data-collapsible={collapsible}>
        {collapsible ? (
          <button css={collapsibleButtonCSS}>{headingContents}</button>
        ) : (
          headingContents
        )}
      </header>
      <div css={cardBodyCSS} style={bodyStyleProps.style}>
        {children}
      </div>
    </section>
  );
}

const _Card = forwardRef(Card);
export { _Card as Card };
