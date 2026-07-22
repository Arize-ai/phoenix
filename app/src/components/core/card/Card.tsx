import type { Ref } from "react";
import { useEffect, useEffectEvent, useId, useState } from "react";

import { Heading } from "../content";
import { DisclosureArrow } from "../icon";
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
  interactiveTitle = false,
  collapseButtonLabel,
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
  const titleId = useId();
  const bodyId = useId();

  const handleCollapseChange = useEffectEvent((collapsed: boolean) => {
    onCollapseChange?.(collapsed);
  });

  useEffect(() => {
    handleCollapseChange(isCollapsed);
  }, [isCollapsed]);

  const headingContents = (
    <div id={titleId}>
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

  const collapseButton = (
    <button
      onClick={() => {
        setIsCollapsed(!isCollapsed);
      }}
      className="card__collapsible-button button--reset"
      id={collapseButtonId}
      aria-controls={bodyId}
      aria-expanded={!isCollapsed}
      aria-label={interactiveTitle ? collapseButtonLabel : undefined}
      // only borrow the title as the accessible name when the caller has not
      // supplied one; a title holding its own control (a select) would otherwise
      // lend the toggle that control's label
      aria-labelledby={
        interactiveTitle && collapseButtonLabel == null ? titleId : undefined
      }
    >
      <DisclosureArrow
        isExpanded={!isCollapsed}
        className="card__collapse-toggle-icon"
      />
      {!interactiveTitle && headingContents}
    </button>
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
          interactiveTitle ? (
            <div className="card__collapsible-header">
              {collapseButton}
              {headingContents}
            </div>
          ) : (
            collapseButton
          )
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
