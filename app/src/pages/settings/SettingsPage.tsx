import React from "react";
import { useLoaderData } from "react-router";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import {
  CopyToClipboardButton,
  Flex,
  Input,
  Label,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { IsAdmin } from "@phoenix/components/auth";
import { BASE_URL, VERSION } from "@phoenix/config";

import { settingsPageLoaderQuery$data } from "./__generated__/settingsPageLoaderQuery.graphql";
import { APIKeysCard } from "./APIKeysCard";
import { DBUsagePieChart } from "./DBUsagePieChart";
import { GenerativeProvidersCard } from "./GenerativeProvidersCard";
import { UsersCard } from "./UsersCard";

const settingsPageCSS = css`
  overflow-y: auto;
  height: 100%;
`;

const settingsPageInnerCSS = css`
  padding: var(--ac-global-dimension-size-400);
  max-width: 1000px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  height: 100%;
`;

const formCSS = css`
  .ac-field {
    // Hacky solution to make the text fields fill the remaining space
    width: calc(100% - var(--ac-global-dimension-size-600));
  }
`;

export function SettingsPage() {
  const data = useLoaderData() as settingsPageLoaderQuery$data;

  return (
    <main css={settingsPageCSS}>
      <div css={settingsPageInnerCSS}>
        <Tabs>
          <TabList>
            <Tab id="general">General</Tab>
            <Tab id="ai-providers">AI Providers</Tab>
            <Tab id="annotations">Annotations</Tab>
          </TabList>

          <TabPanel id="general" padded>
            <Flex direction="column" gap="size-200" width="100%">
              <Flex direction="row" gap="size-200" alignItems="baseline">
                <View flex="2">
                  <Card title="Platform Settings" variant="compact">
                    <form css={formCSS}>
                      <Flex direction="row" gap="size-100" alignItems="end">
                        <TextField value={BASE_URL} isReadOnly>
                          <Label>Hostname</Label>
                          <Input />
                          <Text slot="description">
                            Connect to Phoenix over HTTP
                          </Text>
                        </TextField>
                        <CopyToClipboardButtonWithPadding text={BASE_URL} />
                      </Flex>
                      <Flex direction="row" gap="size-100" alignItems="end">
                        <TextField value={VERSION} isReadOnly>
                          <Label>Platform Version</Label>
                          <Input />
                          <Text slot="description">
                            The version of the Phoenix server
                          </Text>
                        </TextField>
                        <CopyToClipboardButtonWithPadding text={VERSION} />
                      </Flex>
                      <Flex direction="row" gap="size-100" alignItems="start">
                        <TextField
                          value={`pip install 'arize-phoenix==${VERSION}'`}
                          isReadOnly
                        >
                          <Label>Python Version</Label>
                          <Input />
                          <Text slot="description">
                            The version of the Python client library to use to
                            connect to this Phoenix
                          </Text>
                        </TextField>
                        <View flex="none" paddingTop="size-300">
                          <CopyToClipboardButton size="M" text={VERSION} />
                        </View>
                      </Flex>
                    </form>
                  </Card>
                </View>
                <View flex="1" minWidth={280}>
                  <Card title="Database Usage" variant="compact">
                    <DBUsagePieChart query={data} />
                  </Card>
                </View>
              </Flex>
              <IsAdmin>
                <>
                  <APIKeysCard />
                  <UsersCard />
                </>
              </IsAdmin>
            </Flex>
          </TabPanel>

          <TabPanel id="ai-providers" padded>
            <GenerativeProvidersCard query={data} />
          </TabPanel>

          <TabPanel id="annotations" padded>
            <Card title="Annotations Settings" variant="compact">
              <Flex direction="column" gap="size-200">
                <Text>
                  Annotation settings and configurations will be available here.
                </Text>
                <Text>
                  Configure annotation types, labels, and workflows for your
                  projects.
                </Text>
              </Flex>
            </Card>
          </TabPanel>
        </Tabs>
      </div>
    </main>
  );
}

function CopyToClipboardButtonWithPadding(props: { text: string }) {
  return (
    <View paddingBottom="20px" flex="none">
      <CopyToClipboardButton text={props.text} size="M" />
    </View>
  );
}
