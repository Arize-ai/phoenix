import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Heading } from "@phoenix/components/content";

/**
 * A SectionHeading is a component that displays a heading with borders.
 *
 * It is well suited for "labeling" a DisclosureGroup or other sections of content.
 */
export const SectionHeading = ({ children }: PropsWithChildren) => {
  return (
    <div
      css={css`
        & > * {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--ac-global-dimension-static-size-100)
            var(--ac-global-dimension-static-size-200);
          border-top: 1px solid var(--ac-global-border-color-default);
          border-bottom: 1px solid var(--ac-global-border-color-default);
        }
      `}
    >
      <Heading>{children}</Heading>
    </div>
  );
};
