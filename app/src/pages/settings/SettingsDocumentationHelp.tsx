import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { ContextualHelp, ExternalLink, Text } from "@phoenix/components";
import {
  SETTINGS_DOCUMENTATION_TOPICS,
  type SettingsDocumentationTopic,
} from "@phoenix/constants";

const documentationFooterCSS = css`
  margin-top: var(--global-dimension-size-100);
`;

export function SettingsDocumentationHelp({
  children,
  topic,
}: {
  children: ReactNode;
  topic: SettingsDocumentationTopic;
}) {
  const { href, label } = SETTINGS_DOCUMENTATION_TOPICS[topic];

  return (
    <ContextualHelp
      href={href}
      variant="info"
      triggerAriaLabel={`Learn more about ${label}`}
    >
      <Text size="S">{children}</Text>
      <footer css={documentationFooterCSS}>
        <ExternalLink href={href}>View documentation</ExternalLink>
      </footer>
    </ContextualHelp>
  );
}
