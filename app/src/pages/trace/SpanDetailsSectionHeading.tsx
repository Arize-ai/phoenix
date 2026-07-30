import { css } from "@emotion/react";
import type { MouseEvent, PropsWithChildren, ReactNode, Ref } from "react";

import { Heading } from "@phoenix/components";

const spanDetailsSectionHeadingCSS = css`
  position: relative;
  isolation: isolate;

  .span-details-section-heading__header {
    display: flex;
    position: relative;
    z-index: var(--global-z-index-local-raised);
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
    box-sizing: border-box;
    height: var(--global-span-details-section-heading-height);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    border-bottom: 1px solid var(--global-border-color-default);

    &[data-bordered="true"] {
      border-top: 1px solid var(--global-border-color-default);
    }

    &[data-collapsed="true"] {
      border-bottom-width: 0;
    }
  }

  .span-details-section-heading__title {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;

    &[data-interactive="true"] {
      cursor: pointer;
    }
  }

  .span-details-section-heading__heading {
    display: flex;
    align-items: center;
    min-width: 0;
    color: var(--global-text-color-800);
    letter-spacing: 0.06em;
    text-transform: uppercase;

    & > button {
      font: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
    }
  }

  .span-details-section-heading__extra {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    min-width: 0;
  }

  [data-section-navigation-feedback] {
    position: absolute;
    inset: 1px 0;
    z-index: var(--global-z-index-local-base);
    background-color: var(--highlight-background);
    opacity: 0;
    pointer-events: none;
  }
`;

export function SpanDetailsSectionHeading({
  children,
  bordered = true,
  isCollapsed = false,
  titleExtra,
  extra,
  onTitleClick,
  ref,
}: PropsWithChildren<{
  bordered?: boolean;
  isCollapsed?: boolean;
  titleExtra?: ReactNode;
  extra?: ReactNode;
  onTitleClick?: () => void;
  ref?: Ref<HTMLDivElement>;
}>) {
  const handleTitleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('button,a,input,select,textarea,[role="button"]')
    ) {
      return;
    }
    onTitleClick?.();
  };

  return (
    <div
      ref={ref}
      className="span-details-section-heading"
      css={spanDetailsSectionHeadingCSS}
    >
      <div
        className="span-details-section-heading__header"
        data-bordered={bordered}
        data-collapsed={isCollapsed}
      >
        <div
          className="span-details-section-heading__title"
          data-interactive={onTitleClick != null}
          onClick={onTitleClick ? handleTitleClick : undefined}
        >
          <Heading
            className="span-details-section-heading__heading"
            weight="heavy"
          >
            {children}
          </Heading>
          {titleExtra}
        </div>
        {extra != null ? (
          <div className="span-details-section-heading__extra">{extra}</div>
        ) : null}
      </div>
      <span aria-hidden="true" data-section-navigation-feedback />
    </div>
  );
}
