import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";

import { Heading } from "@phoenix/components/core/content";
import type { StylableProps } from "@phoenix/components/core/types";
import { classNames } from "@phoenix/utils/classNames";

import { sectionNavSectionCSS } from "./styles";

export interface SectionNavSectionProps extends StylableProps {
  /**
   * Matches the `id` of this section's link in `SectionNav`. It must be
   * unique within the document.
   */
  id: string;
  /**
   * The visible heading, rendered at level 3. It also names the section for
   * assistive technology.
   */
  heading: ReactNode;
  children?: ReactNode;
  className?: string;
  /** The `<section>` element */
  ref?: Ref<HTMLElement>;
}

/**
 * One section of the pane a `SectionNav` scrolls through. It renders a
 * `<section>` named by its heading, which assistive technology lists as a
 * region landmark. Following its link moves the reading position and focus
 * into it. It takes focus from code but stays out of the tab order.
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
