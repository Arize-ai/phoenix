import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";

import { Heading } from "@phoenix/components/core/content";
import type { StylableProps } from "@phoenix/components/core/types";
import { classNames } from "@phoenix/utils/classNames";

import { sectionNavSectionCSS } from "./styles";

export interface SectionNavSectionProps extends StylableProps {
  /** Matches the `id` of this section's link in `SectionNav` */
  id: string;
  /** Visible heading; also names the section for assistive technology */
  heading: ReactNode;
  children?: ReactNode;
  className?: string;
  ref?: Ref<HTMLElement>;
}

/**
 * One section of the pane a `SectionNav` scrolls through. A focusable
 * `<section id>` (out of the tab order) with a heading, so following its link
 * moves the reading position and focus to it, and lands below the sticky bar.
 */
export function SectionNavSection({
  id,
  heading,
  children,
  css: _css,
  className,
  ref,
}: SectionNavSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      ref={ref}
      id={id}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={classNames("section-nav-section", className)}
      css={css(sectionNavSectionCSS, _css)}
    >
      <Heading id={headingId} weight="heavy">
        {heading}
      </Heading>
      {children}
    </section>
  );
}
