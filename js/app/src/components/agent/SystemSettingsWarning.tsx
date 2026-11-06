import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Alert, Icon, Icons, LinkButton } from "@phoenix/components";

const warningCSS = css`
  margin: 0 var(--global-dimension-size-150) var(--global-dimension-size-150);
`;

const wrapCtaCSS = css`
  & > div {
    flex-wrap: wrap;
    gap: var(--global-dimension-size-100);
  }
`;

export function SystemSettingsWarning({
  isAdmin = false,
  isOnSettingsPage = false,
  adminMessage,
}: {
  isAdmin?: boolean;
  /**
   * When rendered on the assistant settings page itself, admins are pointed
   * at the system settings section above instead of a link to the page.
   */
  isOnSettingsPage?: boolean;
  /**
   * Admin-facing message (shown without the settings link) for settings the
   * system settings page does not control, e.g. env-only server configuration.
   */
  adminMessage?: ReactNode;
}) {
  let message: ReactNode;
  let showSettingsLink = false;
  if (!isAdmin) {
    message =
      "Disabled by system settings. An administrator needs to turn this on.";
  } else if (adminMessage) {
    message = adminMessage;
  } else if (isOnSettingsPage) {
    message =
      "Disabled by system settings. You can enable it for all users in the system settings above.";
  } else {
    message = "Disabled by system settings.";
    showSettingsLink = true;
  }
  return (
    <div css={showSettingsLink ? [warningCSS, wrapCtaCSS] : warningCSS}>
      <Alert
        variant="warning"
        icon={<Icon svg={<Icons.Lock />} />}
        extra={
          showSettingsLink ? (
            <LinkButton size="S" to="/settings/agents">
              Assistant settings
            </LinkButton>
          ) : undefined
        }
      >
        {message}
      </Alert>
    </div>
  );
}
