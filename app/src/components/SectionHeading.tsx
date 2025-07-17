import { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Heading } from "@phoenix/components/content";

/**
 * A SectionHeading is a component that displays a heading with borders.
 *
 * It is well suited for "labeling" a DisclosureGroup or other sections of content.
 */
export const SectionHeading = ({
  children,
  bordered = true,
}: PropsWithChildren & {
  /**
   * If true, the section heading will have a border at the top and bottom
   * If false, the section heading will have a border at the bottom only
   * */
  bordered?: boolean;
}) => {
  return (
    <div
      data-bordered={bordered}
      css={css`
        border-bottom: 1px solid var(--ac-global-border-color-default);
        &[data-bordered="true"] {
          border-top: 1px solid var(--ac-global-border-color-default);
        }
        & > * {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--ac-global-dimension-static-size-100)
            var(--ac-global-dimension-static-size-200);
        }
      `}
    >
      <Heading>{children}</Heading>
    </div>
  );
};
