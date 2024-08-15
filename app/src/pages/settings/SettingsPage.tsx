import React, { Suspense } from "react";
import { css } from "@emotion/react";

import { Card, Flex, TextField, View } from "@arizeai/components";

import { CopyToClipboardButton, Loading } from "@phoenix/components";
import { BASE_URL, VERSION } from "@phoenix/config";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";

import { UsersTable } from "./UsersTable";

const settingsPageCSS = css`
  padding: var(--ac-global-dimension-size-400);
  max-width: 800px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

const formCSS = css`
  .ac-field {
    // Hacky solution to make the text fields fill the remaining space
    width: calc(100% - var(--ac-global-dimension-size-600));
  }
`;

export function SettingsPage() {
  const { authenticationEnabled } = useFunctionality();
  return (
    <main css={settingsPageCSS}>
      <Flex direction="column" gap="size-200" width="100%">
        <Card title="Platform Settings" variant="compact">
          <form css={formCSS}>
            <Flex direction="row" gap="size-100" alignItems="end">
              <TextField
                label="Hostname"
                value={BASE_URL}
                isReadOnly
                description="Connect to Phoenix over HTTP"
              />
              <CopyToClipboardButtonWithPadding text={BASE_URL} />
            </Flex>
            <Flex direction="row" gap="size-100" alignItems="end">
              <TextField
                label="Platform Version"
                isReadOnly
                value={VERSION}
                description="The version of the Phoenix server"
              />
              <CopyToClipboardButtonWithPadding text={VERSION} />
            </Flex>
            <Flex direction="row" gap="size-100" alignItems="end">
              <TextField
                label="Python Version"
                isReadOnly
                value={`pip install 'arize-phoenix==${VERSION}'`}
                description="The version of the Python client library to use to connect to this Phoenix"
              />
              <CopyToClipboardButtonWithPadding text={VERSION} />
            </Flex>
          </form>
        </Card>
        {authenticationEnabled && (
          <Card title="API Keys" variant="compact">
            API settings go here
          </Card>
        )}
        {authenticationEnabled && (
          <Card title="Users" variant="compact" bodyStyle={{ padding: 0 }}>
            <Suspense fallback={<Loading />}>
              <UsersTable />
            </Suspense>
          </Card>
        )}
      </Flex>
    </main>
  );
}

function CopyToClipboardButtonWithPadding(props: { text: string }) {
  return (
    <View paddingBottom="19px">
      <CopyToClipboardButton text={props.text} size="normal" />
    </View>
  );
}
