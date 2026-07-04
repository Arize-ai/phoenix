import type { Ref } from "react";
import { useEffect, useEffectEvent, useId, useState } from "react";

import { Heading } from "../content";
import { DisclosureArrow } from "../disclosure";
import { useStyleProps, viewStyleProps } from "../utils";
import { cardCSS } from "./styles";
import type { CardProps } from "./types";

function Card({
  ref,
  title,
  titleExtra,
  titleSeparator = true,
  subTitle,
  children,
  collapsible = false,
  defaultOpen = true,
  scrollBody = false,
  extra,
  onCollapseChange,
  testId,
  ...otherProps
}: CardProps & { ref?: Ref<HTMLElement> }) {
  const { styleProps } = useStyleProps(otherProps, viewStyleProps);
  const [isCollapsed, setIsCollapsed] = useState(
    collapsible ? !defaultOpen : false
  );

  const headerId = useId();
  const collapseButtonId = useId();
  const bodyId = useId();

  const handleCollapseChange = useEffectEvent((collapsed: boolean) => {
    onCollapseChange?.(collapsed);
  });

  useEffect(() => {
    handleCollapseChange(isCollapsed);
  }, [isCollapsed]);

  const headingContents = (
    <div>
      <Heading level={3} weight="heavy" className="card__title">
        {title}
        {titleExtra}
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
      className="card"
      data-collapsible={collapsible}
      data-collapsed={isCollapsed}
      data-title-separator={titleSeparator}
      data-testid={testId}
      style={styleProps.style}
    >
      <header id={headerId}>
        {collapsible ? (
          <button
            onClick={() => {
              setIsCollapsed(!isCollapsed);
            }}
            className="card__collapsible-button button--reset"
            id={collapseButtonId}
            aria-controls={bodyId}
            aria-expanded={!isCollapsed}
          >
            <DisclosureArrow
              isExpanded={!isCollapsed}
              className="card__collapse-toggle-icon"
            />
            {headingContents}
          </button>
        ) : (
          headingContents
        )}
        {extra}
      </header>
      {
        <div
          className="card__body"
          id={bodyId}
          aria-labelledby={headerId}
          aria-hidden={isCollapsed}
          data-scrollable={scrollBody}
        >
          {children}
        </div>
      }
    </section>
  );
}

export { Card };
