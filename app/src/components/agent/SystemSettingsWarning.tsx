import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text } from "@phoenix/components";

const warningCSS = css`
  margin: 0 var(--global-dimension-size-150)
    var(--global-dimension-size-150);
  color: var(--global-color-warning);
`;

export function SystemSettingsWarning() {
  return (
    <Flex
      direction="row"
      gap="size-75"
      alignItems="center"
      css={warningCSS}
    >
      <Icon svg={<Icons.LockOutline />} />
      <Text color="inherit" size="S">
        Disabled by system settings. An administrator needs to turn this on.
      </Text>
    </Flex>
  );
}
