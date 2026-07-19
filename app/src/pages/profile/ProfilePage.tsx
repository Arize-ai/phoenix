import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useEffect } from "react";
import type { Key } from "react-aria-components";
import { Collection } from "react-aria-components";
import { Navigate, Outlet, useMatch, useNavigate } from "react-router";

import {
  Icon,
  Icons,
  Loading,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@phoenix/components";
import { useViewer } from "@phoenix/contexts/ViewerContext";
import { useMediaQuery } from "@phoenix/hooks";

import { PROFILE_ROUTES, type ProfileRouteId } from "./profileRoutes";

const VERTICAL_TABS_MEDIA_QUERY = "(min-width: 900px)";

const profilePageCSS = css`
  overflow: hidden;
  height: 100%;
`;

const tabLabelCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

const profileTabListCSS = css`
  &[data-orientation="vertical"] {
    flex: none;
    width: var(--global-dimension-size-2400);
    box-sizing: border-box;
    overflow-y: auto;
    padding: var(--global-dimension-size-200) var(--global-dimension-size-100);
  }
  &[data-orientation="horizontal"] {
    margin: 0 var(--global-dimension-size-200);
  }
`;

const profileTabPanelCSS = css`
  overflow-y: auto;
  padding: var(--global-dimension-size-200) var(--global-dimension-size-300)
    var(--global-dimension-size-300);
  & > * {
    flex: none;
    width: 100%;
    max-width: 800px;
    margin-inline: auto;
  }
`;

const TABS = [
  {
    id: PROFILE_ROUTES.account.segment,
    label: PROFILE_ROUTES.account.tabLabel,
    icon: <Icons.Person />,
  },
  {
    id: PROFILE_ROUTES["api-keys"].segment,
    label: PROFILE_ROUTES["api-keys"].tabLabel,
    icon: <Icons.Key />,
  },
  {
    id: PROFILE_ROUTES.apps.segment,
    label: PROFILE_ROUTES.apps.tabLabel,
    icon: <Icons.Link2 />,
  },
  {
    id: PROFILE_ROUTES.preferences.segment,
    label: PROFILE_ROUTES.preferences.tabLabel,
    icon: <Icons.Options />,
  },
] as const satisfies readonly { id: string; label: string; icon: ReactNode }[];

function isProfileTabId(value: string | undefined): value is ProfileRouteId {
  return TABS.some((tab) => tab.id === value);
}

export function ProfilePage() {
  const navigate = useNavigate();
  const isLargeScreen = useMediaQuery(VERTICAL_TABS_MEDIA_QUERY);
  const tab = useMatch("/profile/:tab/*")?.params.tab;
  const { viewer, refetchViewer } = useViewer();
  const tabs = viewer ? TABS : TABS.filter((tab) => tab.id === "preferences");
  const defaultTab: ProfileRouteId = viewer ? "account" : "preferences";

  useEffect(() => {
    refetchViewer();
  }, [refetchViewer]);

  if (!isProfileTabId(tab) || !tabs.some((item) => item.id === tab)) {
    return <Navigate to={PROFILE_ROUTES[defaultTab].path} replace />;
  }

  const onChangeTab = (key: Key) => {
    if (typeof key === "string" && isProfileTabId(key)) {
      navigate(PROFILE_ROUTES[key].path, { replace: true });
    }
  };

  return (
    <main css={profilePageCSS}>
      <Tabs
        selectedKey={tab}
        onSelectionChange={onChangeTab}
        orientation={isLargeScreen ? "vertical" : "horizontal"}
      >
        <TabList items={tabs} css={profileTabListCSS} aria-label="Profile">
          {(item) => (
            <Tab id={item.id}>
              <span css={tabLabelCSS}>
                <Icon svg={item.icon} />
                {item.label}
              </span>
            </Tab>
          )}
        </TabList>
        <Collection items={tabs}>
          {(item) => (
            <TabPanel id={item.id} css={profileTabPanelCSS}>
              <Suspense fallback={<Loading />}>
                <Outlet />
              </Suspense>
            </TabPanel>
          )}
        </Collection>
      </Tabs>
    </main>
  );
}
