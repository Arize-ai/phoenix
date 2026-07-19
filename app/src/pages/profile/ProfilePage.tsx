import { css } from "@emotion/react";
import { Suspense, useEffect } from "react";
import type { Key } from "react-aria-components";
import { Collection } from "react-aria-components";
import { Navigate, Outlet, useMatches, useNavigate } from "react-router";

import { Loading, Tab, TabList, TabPanel, Tabs } from "@phoenix/components";
import { useViewer } from "@phoenix/contexts/ViewerContext";
import { useMediaQuery } from "@phoenix/hooks";
import {
  getRegisteredRouteNavigationCatalog,
  getRouteNavigationMetadata,
  isRouteNavigationEntryVisible,
} from "@phoenix/routing/routeNavigation";
import { RouteNavigationIcon } from "@phoenix/routing/RouteNavigationIcon";
import { normalizePath } from "@phoenix/routing/routeObjects";

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

export function ProfilePage() {
  const navigate = useNavigate();
  const matches = useMatches();
  const isLargeScreen = useMediaQuery(VERTICAL_TABS_MEDIA_QUERY);
  const { viewer, refetchViewer } = useViewer();
  const profileRoutes = getRegisteredRouteNavigationCatalog().filter(
    (route) => route.metadata.section === "Profile"
  );
  const tabs = profileRoutes.filter((route) =>
    isRouteNavigationEntryVisible({ entry: route, hasViewer: viewer !== null })
  );
  const activeProfileMatch = matches.findLast(
    (match) => getRouteNavigationMetadata(match.handle)?.section === "Profile"
  );
  // Router matching is case-insensitive and match.pathname preserves the
  // URL's casing and trailing slash, while catalog paths are normalized
  // lowercase patterns — normalize before comparing so deep links like
  // /profile/api-keys/ select their tab instead of redirecting.
  const activePathname = activeProfileMatch
    ? normalizePath(activeProfileMatch.pathname).toLowerCase()
    : undefined;
  const selectedTab = tabs.find((route) => route.path === activePathname);
  const defaultTab = tabs[0];

  useEffect(() => {
    refetchViewer();
  }, [refetchViewer]);

  if (!defaultTab) {
    throw new Error(
      "Profile routes must define React Router handle.navigation metadata"
    );
  }

  if (!selectedTab) {
    return <Navigate to={defaultTab.path} replace />;
  }

  const onChangeTab = (key: Key) => {
    if (typeof key === "string" && tabs.some((tab) => tab.path === key)) {
      navigate(key, { replace: true });
    }
  };

  return (
    <main css={profilePageCSS}>
      <Tabs
        selectedKey={selectedTab.path}
        onSelectionChange={onChangeTab}
        orientation={isLargeScreen ? "vertical" : "horizontal"}
      >
        <TabList items={tabs} css={profileTabListCSS} aria-label="Profile">
          {(item) => (
            <Tab id={item.path}>
              <span css={tabLabelCSS}>
                <RouteNavigationIcon icon={item.metadata.icon} />
                {item.metadata.label}
              </span>
            </Tab>
          )}
        </TabList>
        <Collection items={tabs}>
          {(item) => (
            <TabPanel id={item.path} css={profileTabPanelCSS}>
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
