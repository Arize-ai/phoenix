import { useCallback } from "react";
import { Key } from "react-aria-components";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { css } from "@emotion/react";

import { LazyTabPanel, Tab, TabList, Tabs } from "@phoenix/components";

const settingsPageCSS = css`
  overflow-y: auto;
  height: 100%;
`;

const settingsPageInnerCSS = css`
  padding: var(--ac-global-dimension-size-100);
  max-width: 1000px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

export function SettingsPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tab = pathname.split("/settings")[1].replace("/", "");
  const onChangeTab = useCallback(
    (tab: Key) => {
      if (typeof tab === "string") {
        navigate(`/settings/${tab}`, { replace: true });
      }
    },
    [navigate]
  );
  if (!tab) {
    return <Navigate to="/settings/general" replace />;
  }
  return (
    <main css={settingsPageCSS}>
      <div css={settingsPageInnerCSS}>
        <Tabs selectedKey={tab} onSelectionChange={onChangeTab}>
          <TabList>
            <Tab id="general">General</Tab>
            <Tab id="providers">AI Providers</Tab>
            <Tab id="annotations">Annotations</Tab>
            <Tab id="data">Data Retention</Tab>
          </TabList>
          <LazyTabPanel id="general" padded>
            <Outlet />
          </LazyTabPanel>
          <LazyTabPanel id="providers" padded>
            <Outlet />
          </LazyTabPanel>
          <LazyTabPanel id="annotations" padded>
            <Outlet />
          </LazyTabPanel>
          <LazyTabPanel id="data" padded>
            <Outlet />
          </LazyTabPanel>
        </Tabs>
      </div>
    </main>
  );
}
