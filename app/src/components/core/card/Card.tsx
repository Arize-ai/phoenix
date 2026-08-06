import type { MouseEvent, Ref } from "react";
import { useEffect, useEffectEvent, useId, useState } from "react";

import { Heading } from "../content";
import { DisclosureArrow } from "../icon";
import { useStyleProps, viewStyleProps } from "../utils";
import { CardProvider } from "./CardContext";
import { cardCSS } from "./styles";
import type { CardProps } from "./types";

function Card({
  ref,
  title,
  titleExtra,
  titleSeparator = true,
  subTitle,
  headerContent,
  children,
  collapsible = false,
  interactiveTitle = false,
  collapseButtonLabel,
  defaultOpen = true,
  isOpen,
  scrollBody = false,
  extra,
  onCollapseChange,
  onOpenChange,
  testId,
  ...otherProps
}: CardProps & { ref?: Ref<HTMLElement> }) {
  const { styleProps } = useStyleProps(otherProps, viewStyleProps);
  const [uncontrolledIsCollapsed, setUncontrolledIsCollapsed] = useState(
    collapsible ? !defaultOpen : false
  );
  const isCollapsed = isOpen == null ? uncontrolledIsCollapsed : !isOpen;

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
    <div id={titleId} className="card__heading">
      <Heading level={3} weight="heavy" className="card__title">
        {title}
        {titleExtra}
      </Heading>
      {subTitle && (
        <Heading level={4} className="card__sub-title">
          {subTitle}
        </Heading>
      )}
      {headerContent && (
        <div className="card__header-content">{headerContent}</div>
      )}
    </div>
  );

  // The local state is kept in step even while `isOpen` controls the card, so a
  // card that later drops back to uncontrolled resumes where the reader left it.
  const toggleCollapsed = () => {
    setUncontrolledIsCollapsed(!isCollapsed);
    onOpenChange?.(isCollapsed);
  };

  // With `interactiveTitle` the toggle itself is only the arrow, so the rest of
  // the header would be dead space. Clicking it toggles too, except where the
  // click lands on a control of its own (the help popover, the toolbar) or on
  // the arrow, which handles itself.
  const handleHeaderClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('button,a,input,select,textarea,[role="button"]')
    ) {
      return;
    }
    toggleCollapsed();
  };

  const collapseButton = (
    <button
      onClick={toggleCollapsed}
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
    <CardProvider isCollapsed={isCollapsed}>
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
              <div
                className="card__collapsible-header"
                onClick={handleHeaderClick}
              >
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
        <div
          className="card__body"
          id={bodyId}
          aria-labelledby={headerId}
          aria-hidden={isCollapsed}
          data-scrollable={scrollBody}
        >
          {children}
        </div>
      </section>
    </CardProvider>
  );
}

export { Card };
