import { Suspense, useCallback } from "react";
import { Collection, Key } from "react-aria-components";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Loading, Tab, TabList, TabPanel, Tabs } from "@phoenix/components";

const settingsPageCSS = css`
  overflow-y: auto;
  height: 100%;
`;

const settingsPageInnerCSS = css`
  padding: var(--ac-global-dimension-size-100);
  max-width: 1300px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

const tabs: { id: string; label: string }[] = [
  { id: "general", label: "General" },
  { id: "providers", label: "AI Providers" },
  { id: "models", label: "Models" },
  { id: "datasets", label: "Datasets" },
  { id: "annotations", label: "Annotations" },
  { id: "prompts", label: "Prompts" },
  { id: "data", label: "Data Retention" },
  { id: "display", label: "Display Preferences" },
];

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
          <TabList items={tabs}>
            {(item) => <Tab id={item.id}>{item.label}</Tab>}
          </TabList>
          <Collection items={tabs}>
            {(item) => (
              <TabPanel id={item.id} padded>
                <Suspense fallback={<Loading />}>
                  <Outlet />
                </Suspense>
              </TabPanel>
            )}
          </Collection>
        </Tabs>
      </div>
    </main>
  );
}
