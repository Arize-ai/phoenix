import { css } from "@emotion/react";

import { promptInputSurfaceCSS } from "@phoenix/components/ai/prompt-input";

import {
  SpanDetailsDisclosureSection,
  type SpanDetailsDisclosureSectionProps,
} from "./SpanDetailsDisclosureSection";

const spanDetailsInputBodyCSS = css`
  ${promptInputSurfaceCSS}

  margin: var(--global-grid-margin-xsmall);
  overflow: hidden;
`;

type SpanDetailsInputSectionProps = Omit<
  SpanDetailsDisclosureSectionProps,
  "title"
>;

/** A span input section whose body matches the assistant prompt surface. */
export function SpanDetailsInputSection({
  children,
  ...props
}: SpanDetailsInputSectionProps) {
  return (
    <SpanDetailsDisclosureSection title="Input" {...props}>
      <div
        className="span-details-input-section__body"
        css={spanDetailsInputBodyCSS}
      >
        {children}
      </div>
    </SpanDetailsDisclosureSection>
  );
}
