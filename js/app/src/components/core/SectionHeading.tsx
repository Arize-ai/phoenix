import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

import { Heading, Text } from "@phoenix/components/core/content";

const sectionHeadingCSS = css`
  border-bottom: 1px solid var(--global-border-color-default);
  &[data-bordered="true"] {
    border-top: 1px solid var(--global-border-color-default);
  }
  .section-heading__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--global-dimension-size-200);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  }
  .section-heading__titles {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-25);
    min-width: 0;
  }
  .section-heading__titles > .heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .section-heading__extra {
    flex: none;
  }
`;

/**
 * A SectionHeading is a component that displays a heading with borders.
 *
 * It is well suited for "labeling" a DisclosureGroup or other sections of content,
 * such as the full-width sections of a form dialog.
 */
export const SectionHeading = ({
  children,
  bordered = true,
  subtitle,
  extra,
}: PropsWithChildren & {
  /**
   * If true, the section heading will have a border at the top and bottom
   * If false, the section heading will have a border at the bottom only
   * */
  bordered?: boolean;
  /** A one-line description shown under the heading. */
  subtitle?: ReactNode;
  /** Controls shown at the end of the heading, e.g. a switch or a button. */
  extra?: ReactNode;
}) => {
  return (
    <div data-bordered={bordered} css={sectionHeadingCSS}>
      <div className="section-heading__row">
        <div className="section-heading__titles">
          <Heading>{children}</Heading>
          {subtitle ? (
            <Text size="XS" color="text-700">
              {subtitle}
            </Text>
          ) : null}
        </div>
        {extra ? <div className="section-heading__extra">{extra}</div> : null}
      </div>
    </div>
  );
};
