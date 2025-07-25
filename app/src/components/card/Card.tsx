import {
  CSSProperties,
  forwardRef,
  PropsWithChildren,
  Ref,
  useState,
} from "react";
import { css } from "@emotion/react";

import { Card as OldCard } from "@arizeai/components";

import { Heading, Icon, Icons } from "@phoenix/components";
import { ViewStyleProps } from "@phoenix/components/types";
import { useStyleProps, viewStyleProps } from "@phoenix/components/utils";

type CardVariant = "default" | "compact";

export interface CardProps extends PropsWithChildren<ViewStyleProps> {
  title: string;
  subTitle?: string;
  variant?: CardVariant;
  collapsible?: boolean;
  bodyStyle?: ViewStyleProps;
  useOldComponent?: boolean; // TODO: delete
}

const cardCSS = (style?: CSSProperties) => css`
  --scope-border-color: ${style?.borderColor ??
  "var(--ac-global-border-color-default)"};
  --card-header-height: 68px;
  --collapsible-card-animation-duration: 200ms;
  --collapsible-card-icon-size: var(--ac-global-dimension-size-300);

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

  & .card__collapsible-icon {
    width: var(--collapsible-card-icon-size);
    height: var(--collapsible-card-icon-size);
    font-size: 1.3em;
    color: inherit;
    display: flex;
    margin-right: var(--ac-global-dimension-static-size-100);
    transition: transform ease var(--collapsible-card-animation-duration);
  }

  & .card__title {
    font-size: var(--ac-global-font-size-l);
    line-height: var(--ac-global-line-height-l);
  }

  &[data-variant="compact"] {
    & .card__title {
      font-size: var(--ac-global-font-size-m);
      line-height: var(--ac-global-line-height-m);
    }
  }

  & .card__sub-title {
    color: var(--ac-global-text-color-700);
  }

  &[data-collapsible="true"] {
    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    &[data-collapsed="true"] {
      .card__collapsible-icon {
        transform: rotate(-90deg);
      }
    }

    &[data-collapsed="false"] {
      border-bottom: 1px solid var(--scope-border-color);
    }
  }
`;

const collapsibleButtonCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  text-align: left;
  width: 100%;
  height: 100%;
  appearance: none;
  cursor: pointer;
  color: var(--ac-global-text-color-900);

  & svg {
    height: var(--collapsible-card-icon-size);
    width: var(--collapsible-card-icon-size);
  }
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (useOldComponent) {
    return (
      <OldCard title={title} {...styleProps}>
        {children}
      </OldCard>
    );
  }
  const headingContents = (
    <div>
      <Heading level={3} weight="heavy" className="card__title">
        {title}
      </Heading>
      {subTitle && (
        <Heading level={4} className="card__sub-title">
          {subTitle}
        </Heading>
      )}
    </div>
  );

  return (
    <section
      ref={ref}
      css={cardCSS(styleProps.style)}
      data-variant={variant}
      style={styleProps.style}
    >
      <header
        css={cardHeaderCSS}
        data-variant={variant}
        data-collapsible={collapsible}
        data-collapsed={isCollapsed}
      >
        {collapsible ? (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            css={collapsibleButtonCSS}
            className="button--reset"
          >
            <Icon
              svg={<Icons.ChevronDown />}
              className="card__collapsible-icon"
            />
            {headingContents}
          </button>
        ) : (
          headingContents
        )}
      </header>
      {!isCollapsed && (
        <div css={cardBodyCSS} style={bodyStyleProps.style}>
          {children}
        </div>
      )}
    </section>
  );
}

const _Card = forwardRef(Card);
export { _Card as Card };
