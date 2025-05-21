import { useMemo } from "react";
import { css } from "@emotion/react";

import {
  DropdownButton,
  DropdownMenu,
  DropdownTrigger,
} from "@arizeai/components";

import {
  CopyToClipboardButton,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  View,
} from "@phoenix/components";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
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
      `# Get the current dataset version\n` +
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
                <Flex
                  direction="row"
                  gap="size-100"
                  alignItems="end"
                  width="100%"
                >
                  <TextField isReadOnly value={datasetId}>
                    <Label>Dataset ID</Label>
                    <Input />
                  </TextField>
                  <CopyToClipboardButton text={datasetId} size="M" />
                </Flex>
                <Flex direction="row" gap="size-100" alignItems="end">
                  <TextField
                    isReadOnly
                    value={version?.id || "No Versions"}
                    isInvalid={!version}
                  >
                    <Label>Version ID</Label>
                    <Input />
                  </TextField>
                  <CopyToClipboardButton
                    text={version?.id || "No Versions"}
                    isDisabled={!version}
                    size="M"
                  />
                </Flex>
              </Form>
            </View>
            <Tabs>
              <TabList>
                <Tab id="python">Python</Tab>
                <Tab id="rest">REST</Tab>
              </TabList>
              <TabPanel id="python">
                <View
                  margin="size-200"
                  borderColor="light"
                  borderWidth="thin"
                  borderRadius="small"
                >
                  <PythonBlockWithCopy value={pythonCode} />
                </View>
              </TabPanel>
              <TabPanel id="rest">
                <View padding="size-200">
                  <Form>
                    <Flex direction="row" gap="size-100" alignItems="end">
                      <TextField isReadOnly value={datasetURL}>
                        <Label>URL</Label>
                        <Input />
                      </TextField>
                      <CopyToClipboardButton text={datasetURL} size="M" />
                    </Flex>
                  </Form>
                </View>
              </TabPanel>
            </Tabs>
          </section>
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
