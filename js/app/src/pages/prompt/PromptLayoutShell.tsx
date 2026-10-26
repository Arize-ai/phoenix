import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import {
  Button,
  Counter,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  Link,
  LinkButton,
  PageHeader,
  Tab,
  TabList,
  Tabs,
  Text,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";

const mainCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .tabs {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    div[role="tablist"] {
      flex: none;
    }
    .tabs__pane-container {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      div[role="tabpanel"]:not([hidden]) {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
    }
  }
`;

export type PromptLayoutShellProps = {
  /**
   * The id of the prompt or decision, used to build the tab URLs
   */
  id: string;
  name: string;
  /**
   * The label of the first tab, e.g. "Prompt" or "Decision"
   */
  kindLabel: string;
  /**
   * The record this one was cloned from, if any
   */
  source?: { id: string; name: string } | null;
  /**
   * The dialog rendered when the Clone button is pressed
   */
  cloneDialog: ReactNode;
  playgroundTo: string;
  playgroundAriaLabel: string;
  versionCount: number;
};

/**
 * The header and tabs shared by the detail pages of prompts and decisions.
 * Each tab renders the matching child route.
 */
export function PromptLayoutShell({
  id,
  name,
  kindLabel,
  source,
  cloneDialog,
  playgroundTo,
  playgroundAriaLabel,
  versionCount,
}: PromptLayoutShellProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  let selectedTab = "prompt";
  if (pathname.includes("versions")) {
    selectedTab = "versions";
  } else if (pathname.includes("config")) {
    selectedTab = "config";
  }
  return (
    <main css={mainCSS}>
      <PageHeader
        title={name}
        subTitle={
          source && (
            <Text color="text-700">
              cloned from{" "}
              <Link to={`/prompts/${source.id}`}>{source.name}</Link>
            </Text>
          )
        }
        extra={
          <Flex direction="row" gap="size-100" justifyContent="end">
            <DialogTrigger>
              <Button
                size="M"
                leadingVisual={<Icon svg={<Icons.GitBranch />} />}
              >
                Clone
              </Button>
              <ViewportModalOverlay>
                <ViewportModal size="M">{cloneDialog}</ViewportModal>
              </ViewportModalOverlay>
            </DialogTrigger>
            <LinkButton
              variant="primary"
              leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
              to={playgroundTo}
              size="M"
              aria-label={playgroundAriaLabel}
            >
              Playground
            </LinkButton>
          </Flex>
        }
      />
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => {
          let url: string;
          if (key === "versions") {
            url = `/prompts/${id}/versions`;
          } else if (key === "config") {
            url = `/prompts/${id}/config`;
          } else {
            url = `/prompts/${id}`;
          }
          navigate(url);
        }}
      >
        <TabList>
          <Tab id="prompt">{kindLabel}</Tab>
          <Tab id="versions">
            Versions <Counter>{versionCount}</Counter>
          </Tab>
          <Tab id="config">Config</Tab>
        </TabList>
        <LazyTabPanel id="prompt">
          <Outlet />
        </LazyTabPanel>
        <LazyTabPanel id="versions">
          <Outlet />
        </LazyTabPanel>
        <LazyTabPanel id="config">
          <Outlet />
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}
