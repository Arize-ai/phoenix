import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Text } from "@phoenix/components";

const sectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-static-size-100);
`;

const sectionTitleCSS = css`
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

/** Titled wrapper shared by every scenario in the lab. */
export function LabSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section css={sectionCSS}>
      <Text size="XS" color="text-300" css={sectionTitleCSS}>
        {title}
      </Text>
      {children}
    </section>
  );
}
