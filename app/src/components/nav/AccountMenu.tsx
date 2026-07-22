import { css } from "@emotion/react";
import { Button } from "react-aria-components";
import { useMatch, useNavigate } from "react-router";

import {
  Flex,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useViewer } from "@phoenix/contexts";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";
import { classNames } from "@phoenix/utils/classNames";
import { prependBasename } from "@phoenix/utils/routingUtils";

import { navLinkCSS } from "./Navbar";
import { ThemeToggle } from "./ThemeToggle";

const identityCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border-bottom: 1px solid var(--global-menu-border-color);
`;

/**
 * The consolidated account menu that sits at the bottom of the side nav. It
 * gathers the user's identity, profile settings, documentation, support, and
 * the theme picker into a single popover so the nav itself stays uncluttered.
 */
export function AccountMenu({ isExpanded }: { isExpanded: boolean }) {
  const navigate = useNavigate();
  const { viewer } = useViewer();
  const { authenticationEnabled } = useFunctionality();
  const displayName = viewer?.username || "Account";
  const managementUrl =
    viewer?.isManagementUser && window.Config.managementUrl
      ? window.Config.managementUrl
      : null;
  // The trigger is a button rather than a router NavLink, so it must compute
  // the active state itself for the routes reachable only through this menu.
  const profileMatch = useMatch("/profile/*");
  const supportMatch = useMatch("/support/*");
  const isOnAccountRoute = Boolean(profileMatch || supportMatch);
  return (
    <TooltipTrigger delay={0} isDisabled={isExpanded}>
      <MenuTrigger>
        <Button
          css={navLinkCSS}
          className={classNames("button--reset account-menu__trigger", {
            active: isOnAccountRoute,
          })}
          aria-label="Account"
        >
          <Icon svg={<Icons.CircleUserRound />} />
          <Text>Account</Text>
        </Button>
        <MenuContainer placement="right bottom" minHeight={0}>
          {viewer ? (
            <MenuHeader>
              <div css={identityCSS} className="account-menu__identity">
                <UserPicture
                  name={displayName}
                  profilePictureUrl={viewer.profilePictureUrl}
                  size={32}
                />
                <Flex direction="column" minWidth={0}>
                  <Text weight="heavy">{viewer.username}</Text>
                  <Text size="XS" color="text-700">
                    {viewer.email}
                  </Text>
                </Flex>
              </div>
            </MenuHeader>
          ) : null}
          <Menu aria-label="Account">
            <MenuItem
              onAction={() => navigate("/profile")}
              leadingContent={<Icon svg={<Icons.Person />} />}
            >
              Profile
            </MenuItem>
            <MenuItem
              href="https://arize.com/docs/phoenix"
              target="_blank"
              rel="noreferrer"
              leadingContent={<Icon svg={<Icons.Book />} />}
            >
              Documentation
            </MenuItem>
            <MenuItem
              onAction={() => navigate("/support")}
              leadingContent={<Icon svg={<Icons.LifeBuoy />} />}
            >
              Support
            </MenuItem>
            {managementUrl ? (
              <MenuItem
                href={managementUrl}
                leadingContent={<Icon svg={<Icons.Server />} />}
              >
                Management Console
              </MenuItem>
            ) : null}
            {authenticationEnabled ? (
              <MenuItem
                onAction={() =>
                  window.location.replace(prependBasename("/auth/logout"))
                }
                leadingContent={<Icon svg={<Icons.LogOut />} />}
              >
                Log Out
              </MenuItem>
            ) : null}
          </Menu>
          <MenuFooter>
            <ThemeToggle />
          </MenuFooter>
        </MenuContainer>
      </MenuTrigger>
      <Tooltip placement="right" offset={10}>
        Account
      </Tooltip>
    </TooltipTrigger>
  );
}
