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
  TextField,
  View,
} from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

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
          <View padding="size-200">
            <Form>
              <Flex direction="row" gap="size-100" alignItems="end">
                <TextField label="Dataset ID" value={datasetId} />
                <CopyToClipboardButton text={datasetId} size="normal" />
              </Flex>
              <Flex direction="row" gap="size-100" alignItems="end">
                <TextField label="Version ID" value={version.id} />
                <CopyToClipboardButton text={version.id} size="normal" />
              </Flex>
            </Form>
          </View>
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
