import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

import { promptInputSurfaceCSS } from "@phoenix/components/ai/prompt-input";

import {
  SpanDetailsDisclosureSection,
  type SpanDetailsDisclosureSectionProps,
} from "./SpanDetailsDisclosureSection";

const spanDetailsInputSurfaceCSS = css`
  ${promptInputSurfaceCSS}

  margin: var(--global-grid-margin-xsmall);
  overflow: hidden;
`;

type SpanDetailsInputSectionProps = Omit<
  SpanDetailsDisclosureSectionProps,
  "title"
>;

/** A neutral top-level section for a span's input content. */
export function SpanDetailsInputSection({
  children,
  ...props
}: SpanDetailsInputSectionProps) {
  return (
    <SpanDetailsDisclosureSection title="Input" {...props}>
      {children}
    </SpanDetailsDisclosureSection>
  );
}

/** The assistant prompt treatment for input content without its own card. */
export function SpanDetailsInputSurface({ children }: PropsWithChildren) {
  return (
    <div
      className="span-details-input-section__surface"
      css={spanDetailsInputSurfaceCSS}
    >
      {children}
    </div>
  );
}
