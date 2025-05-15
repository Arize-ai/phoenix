import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import {
  CopyToClipboardButton,
  Flex,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { CanManageRetentionPolicy, IsAdmin } from "@phoenix/components/auth";
import { BASE_URL, VERSION } from "@phoenix/config";
import { APIKeysCard } from "@phoenix/pages/settings/APIKeysCard";
import { DBUsagePieChart } from "@phoenix/pages/settings/DBUsagePieChart";
import { GlobalRetentionPolicyCard } from "@phoenix/pages/settings/GlobalRetentionPolicyCard";
import { settingsGeneralPageLoader } from "@phoenix/pages/settings/settingsGeneralPageLoader";
import { UsersCard } from "@phoenix/pages/settings/UsersCard";

const formCSS = css`
  .ac-field {
    // Hacky solution to make the text fields fill the remaining space
    width: calc(100% - var(--ac-global-dimension-size-600));
  }
`;

export function SettingsGeneralPage() {
  const loaderData = useLoaderData<typeof settingsGeneralPageLoader>();
  invariant(loaderData, "loaderData is required");
  return (
    <Flex direction="column" gap="size-200" width="100%">
      <Flex direction="row" gap="size-200" alignItems="baseline">
        <View flex="2">
          <Card title="Platform Settings" variant="compact">
            <form css={formCSS}>
              <Flex direction="row" gap="size-100" alignItems="end">
                <TextField value={BASE_URL} isReadOnly>
                  <Label>Hostname</Label>
                  <Input />
                  <Text slot="description">Connect to Phoenix over HTTP</Text>
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
                    The version of the Python client library to use to connect
                    to this Phoenix
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
            <DBUsagePieChart query={loaderData} />
          </Card>
        </View>
      </Flex>
      <IsAdmin>
        <APIKeysCard />
        <UsersCard />
      </IsAdmin>
      <CanManageRetentionPolicy>
        <GlobalRetentionPolicyCard />
      </CanManageRetentionPolicy>
    </Flex>
  );
}

function CopyToClipboardButtonWithPadding(props: { text: string }) {
  return (
    <View paddingBottom="20px" flex="none">
      <CopyToClipboardButton text={props.text} size="M" />
    </View>
  );
}
