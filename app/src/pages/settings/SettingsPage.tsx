import React from "react";
import { css } from "@emotion/react";

import { Card, Flex, TextField, View } from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { IsAdmin } from "@phoenix/components/auth";
import { BASE_URL, VERSION } from "@phoenix/config";

import { APIKeysCard } from "./APIKeysCard";
import { UsersCard } from "./UsersCard";

const settingsPageCSS = css`
  overflow-y: auto;
`;

const settingsPageInnerCSS = css`
  padding: var(--ac-global-dimension-size-400);
  max-width: 1000px;
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
  return (
    <main css={settingsPageCSS}>
      <div css={settingsPageInnerCSS}>
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
              <Flex
                direction="row"
                gap="size-100"
                alignItems="end"
                justifyContent="center"
              >
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
          <IsAdmin>
            <>
              <APIKeysCard />
              <UsersCard />
            </>
          </IsAdmin>
        </Flex>
      </div>
    </main>
  );
}

function CopyToClipboardButtonWithPadding(props: { text: string }) {
  return (
    <View paddingBottom="19px">
      <CopyToClipboardButton text={props.text} size="default" />
    </View>
  );
}
