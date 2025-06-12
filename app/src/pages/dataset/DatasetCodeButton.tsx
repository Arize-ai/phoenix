import { useMemo, useState } from "react";

import {
  Button,
  CopyToClipboardButton,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
  View,
} from "@phoenix/components";
import {
  CodeLanguage,
  CodeLanguageRadioGroup,
} from "@phoenix/components/code/CodeLanguageRadioGroup";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { TypeScriptBlockWithCopy } from "@phoenix/components/code/TypeScriptBlockWithCopy";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { BASE_URL } from "@phoenix/config";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

function getTypeScriptCode(datasetId: string) {
  return `import { getDataset } from "@arizeai/phoenix-client/datasets";

const dataset = await getDataset({ dataset: { datasetId: "${datasetId}" } });
`;
}

function DatasetCodeDialogContent() {
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  const datasetId = useDatasetContext((state) => state.datasetId);
  const version = useDatasetContext((state) => state.latestVersion);
  let datasetURL = `${BASE_URL}/v1/datasets/${datasetId}/examples`;
  if (version) {
    datasetURL += `?version-id=${version.id}`;
  }

  const pythonCode = useMemo(() => {
    return (
      `import phoenix as px\n\n` +
      `client = px.Client()\n` +
      `# Get the current dataset version\n` +
      `dataset = client.get_dataset(id="${datasetId}"${version ? `, version_id="${version.id}"` : ""})`
    );
  }, [datasetId, version]);

  return (
    <>
      <View padding="size-200">
        <Flex direction="column" gap="size-100">
          <Flex direction="row" gap="size-100" alignItems="end" width="100%">
            <TextField isReadOnly value={datasetId} size="S">
              <Label>Dataset ID</Label>
              <Input />
            </TextField>
            <CopyToClipboardButton text={datasetId} size="S" />
          </Flex>
          <Flex direction="row" gap="size-100" alignItems="end">
            <TextField
              isReadOnly
              value={version?.id || "No Versions"}
              isInvalid={!version}
              size="S"
            >
              <Label>Latest Version ID</Label>
              <Input />
            </TextField>
            <CopyToClipboardButton
              text={version?.id || "No Versions"}
              isDisabled={!version}
              size="S"
            />
          </Flex>
          <Flex direction="row" gap="size-100" alignItems="end">
            <TextField isReadOnly value={datasetURL} size="S">
              <Label>REST API URL</Label>
              <Input />
            </TextField>
            <CopyToClipboardButton text={datasetURL} size="S" />
          </Flex>
        </Flex>
      </View>
      <View paddingX="size-200" paddingY="size-100">
        <CodeLanguageRadioGroup
          language={language}
          onChange={setLanguage}
          size="S"
        />
      </View>
      <View paddingX="size-200" paddingY="size-100">
        <CodeWrap>
          {language === "Python" ? (
            <PythonBlockWithCopy value={pythonCode} />
          ) : (
            <TypeScriptBlockWithCopy value={getTypeScriptCode(datasetId)} />
          )}
        </CodeWrap>
      </View>
    </>
  );
}

export function DatasetCodeButton() {
  return (
    <DialogTrigger>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.Code />} />}
        aria-label="Show Dataset Code"
      />

      <ModalOverlay isDismissable>
        <Modal variant="slideover" size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Code to Access Dataset</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <DatasetCodeDialogContent />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
