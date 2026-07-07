import { css } from "@emotion/react";

import { Alert, Icon, Icons, LinkButton } from "@phoenix/components";

const warningCSS = css`
  margin: 0 var(--global-dimension-size-150) var(--global-dimension-size-150);
`;

export function SystemSettingsWarning({
  isAdmin = false,
}: {
  isAdmin?: boolean;
}) {
  return (
    <div css={warningCSS}>
      <Alert
        variant="warning"
        icon={<Icon svg={<Icons.Lock />} />}
        extra={
          isAdmin ? (
            <LinkButton size="S" to="/settings/agents">
              Assistant settings
            </LinkButton>
          ) : undefined
        }
      >
        {isAdmin
          ? "Disabled by system settings."
          : "Disabled by system settings. An administrator needs to turn this on."}
      </Alert>
    </div>
  );
}
