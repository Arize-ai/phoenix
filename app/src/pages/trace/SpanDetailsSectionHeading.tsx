import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode, Ref } from "react";

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
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    border-bottom: 1px solid var(--global-border-color-default);

    &[data-bordered="true"] {
      border-top: 1px solid var(--global-border-color-default);
    }
  }

  .span-details-section-heading__title {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }

  .span-details-section-heading__heading {
    display: flex;
    align-items: center;
    min-width: 0;
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
  titleExtra,
  extra,
  ref,
}: PropsWithChildren<{
  bordered?: boolean;
  titleExtra?: ReactNode;
  extra?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}>) {
  return (
    <div
      ref={ref}
      className="span-details-section-heading"
      css={spanDetailsSectionHeadingCSS}
    >
      <div
        className="span-details-section-heading__header"
        data-bordered={bordered}
      >
        <div className="span-details-section-heading__title">
          <Heading className="span-details-section-heading__heading">
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
