import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { ContextualHelp, ExternalLink, Text } from "@phoenix/components";

const documentationFooterCSS = css`
  border-top: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  margin-top: var(--global-dimension-size-100);
  padding-top: var(--global-dimension-size-100);
`;

export function SettingsDocumentationHelp({
  children,
  href,
  topic,
}: {
  children: ReactNode;
  href: string;
  topic: string;
}) {
  return (
    <ContextualHelp
      href={href}
      variant="info"
      triggerAriaLabel={`Learn more about ${topic}`}
    >
      <Text size="S">{children}</Text>
      <footer css={documentationFooterCSS}>
        <ExternalLink href={href}>View documentation</ExternalLink>
      </footer>
    </ContextualHelp>
  );
}
