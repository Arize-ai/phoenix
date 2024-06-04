import React from "react";
import { css } from "@emotion/react";

import {
  DropdownButton,
  DropdownMenu,
  DropdownTrigger,
  Flex,
  Form,
  Icon,
  Icons,
  TabPane,
  Tabs,
  TextField,
  View,
} from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

/**
 * A Dropdown that displays how to code against a dataset
 */
export function DatasetCodeDropdown() {
  const datasetId = useDatasetContext((state) => state.datasetId);
  const version = useDatasetContext((state) => state.latestVersion);
  return (
    <div
      css={css`
        button.ac-dropdown-button {
          min-width: 80px;
          .ac-dropdown-button__text {
            padding-right: 10px;
          }
        }
      `}
    >
      <DropdownTrigger placement="bottom right">
        <DropdownButton addonBefore={<Icon svg={<Icons.Code />} />}>
          Code
        </DropdownButton>
        <DropdownMenu>
          <Tabs>
            <TabPane name="Info">
              <View padding="size-200">
                <Form>
                  <Flex direction="row" gap="size-100" alignItems="end">
                    <TextField
                      label="Dataset ID"
                      isReadOnly
                      value={datasetId}
                    />
                    <CopyToClipboardButton text={datasetId} size="normal" />
                  </Flex>
                  <Flex direction="row" gap="size-100" alignItems="end">
                    <TextField
                      label="Version ID"
                      isReadOnly
                      value={version?.id || "No Versions"}
                      validationState={!version ? "invalid" : "valid"}
                    />
                    <CopyToClipboardButton
                      text={version?.id || "No Versions"}
                      disabled={!version}
                      size="normal"
                    />
                  </Flex>
                </Form>
              </View>
            </TabPane>
            <TabPane name="Python" hidden>
              Coming Soon
            </TabPane>
          </Tabs>
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
