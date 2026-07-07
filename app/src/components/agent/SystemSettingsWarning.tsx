import { css } from "@emotion/react";

import { Flex, Icon, Icons, Link, Text } from "@phoenix/components";

const warningCSS = css`
  margin: 0 var(--global-dimension-size-150) var(--global-dimension-size-150);
  color: var(--global-color-warning);
`;

export function SystemSettingsWarning({
  isAdmin = false,
}: {
  isAdmin?: boolean;
}) {
  return (
    <Flex direction="row" gap="size-75" alignItems="center" css={warningCSS}>
      <Icon svg={<Icons.Lock />} />
      <Text color="inherit" size="S">
        {isAdmin ? (
          <>
            Disabled by system settings. You can turn it on for all users in{" "}
            <Link to="/settings/agents">Assistant settings</Link>.
          </>
        ) : (
          "Disabled by system settings. An administrator needs to turn this on."
        )}
      </Text>
    </Flex>
  );
}
