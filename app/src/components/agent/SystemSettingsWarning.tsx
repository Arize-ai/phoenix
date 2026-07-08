import { css } from "@emotion/react";

import { Alert, Icon, Icons, LinkButton } from "@phoenix/components";

const warningCSS = css`
  margin: 0 var(--global-dimension-size-150) var(--global-dimension-size-150);
`;

export function SystemSettingsWarning({
  isAdmin = false,
  systemSettingsHint = "link",
}: {
  isAdmin?: boolean;
  /**
   * How to direct admins to the system setting: "link" renders a button to
   * the assistant settings page; "above" points at the system settings
   * section rendered above (for use on the settings page itself).
   */
  systemSettingsHint?: "link" | "above";
}) {
  const showSettingsLink = isAdmin && systemSettingsHint === "link";
  return (
    <div css={warningCSS}>
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
        {!isAdmin
          ? "Disabled by system settings. An administrator needs to turn this on."
          : systemSettingsHint === "above"
            ? "Disabled by system settings. You can enable it for all users in the system settings above."
            : "Disabled by system settings."}
      </Alert>
    </div>
  );
}
