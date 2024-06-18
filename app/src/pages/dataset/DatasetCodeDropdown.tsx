import React, { useMemo } from "react";
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
import { PythonBlock } from "@phoenix/components/code";
import { BASE_URL } from "@phoenix/config";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

/**
 * A Dropdown that displays how to code against a dataset
 */
export function DatasetCodeDropdown() {
  const datasetId = useDatasetContext((state) => state.datasetId);
  const version = useDatasetContext((state) => state.latestVersion);
  let datasetURL = `${BASE_URL}/v1/datasets/${datasetId}/examples`;
  if (version) {
    datasetURL += `?version-id=${version.id}`;
  }

  const pythonCode = useMemo(() => {
    return (
      `import phoenix as px\n` +
      `client = px.Client()\n` +
      `# Get the latest dataset\n` +
      `dataset = client.get_dataset(id="${datasetId}"${version ? `, version_id="${version.id}"` : ""})`
    );
  }, [datasetId, version]);
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
          <section
            css={css`
              width: 500px;
              .ac-field {
                flex: 1 1 auto;
              }
            `}
          >
            <View padding="size-200">
              <Form>
                <Flex direction="row" gap="size-100" alignItems="end">
                  <TextField label="Dataset ID" isReadOnly value={datasetId} />
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
            <Tabs>
              <TabPane name="Python">
                <View
                  margin="size-200"
                  borderColor="light"
                  borderWidth="thin"
                  borderRadius="small"
                >
                  <div
                    className="python-code-block"
                    css={css`
                      position: relative;
                      .copy-to-clipboard-button {
                        position: absolute;
                        top: var(--ac-global-dimension-size-100);
                        right: var(--ac-global-dimension-size-100);
                        z-index: 1;
                      }
                    `}
                  >
                    <CopyToClipboardButton text={pythonCode} />
                    <PythonBlock value={pythonCode} />
                  </div>
                </View>
              </TabPane>
              <TabPane name="REST">
                <View padding="size-200">
                  <Form>
                    <Flex direction="row" gap="size-100" alignItems="end">
                      <TextField label="URL" isReadOnly value={datasetURL} />
                      <CopyToClipboardButton text={datasetURL} size="normal" />
                    </Flex>
                  </Form>
                </View>
              </TabPane>
            </Tabs>
          </section>
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
