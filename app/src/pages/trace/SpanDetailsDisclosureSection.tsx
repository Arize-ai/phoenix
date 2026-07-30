import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { useId, useState } from "react";

import { DisclosureArrow } from "@phoenix/components";

import { SpanDetailsSectionHeading } from "./SpanDetailsSectionHeading";

const spanDetailsDisclosureToggleCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  border-radius: var(--global-rounding-small);
  color: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`;

export type SpanDetailsDisclosureSectionProps = PropsWithChildren<{
  sectionId: string;
  title: string;
  bordered?: boolean;
  titleExtra?: ReactNode;
  extra?: ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}>;

/**
 * A collapsible, navigable top-level section in the span details panel.
 *
 * Repeated values such as messages, documents, and individual tool schemas
 * remain nested inside the section body; this component owns the one stable
 * disclosure for their semantic group.
 */
export function SpanDetailsDisclosureSection({
  sectionId,
  title,
  bordered = true,
  titleExtra,
  extra,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onOpenChange,
  children,
}: SpanDetailsDisclosureSectionProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const toggleId = useId();
  const bodyId = useId();

  const toggleOpen = () => {
    const nextIsOpen = !isOpen;
    setUncontrolledIsOpen(nextIsOpen);
    onOpenChange?.(nextIsOpen);
  };

  return (
    <section id={sectionId} aria-label={title} data-span-info-section>
      <SpanDetailsSectionHeading
        bordered={bordered}
        isCollapsed={!isOpen}
        titleExtra={titleExtra}
        extra={extra}
        onTitleClick={toggleOpen}
      >
        <button
          id={toggleId}
          type="button"
          className="button--reset"
          css={spanDetailsDisclosureToggleCSS}
          aria-controls={bodyId}
          aria-expanded={isOpen}
          onClick={toggleOpen}
        >
          <DisclosureArrow isExpanded={isOpen} />
          {title}
        </button>
      </SpanDetailsSectionHeading>
      <div id={bodyId} aria-labelledby={toggleId} hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
