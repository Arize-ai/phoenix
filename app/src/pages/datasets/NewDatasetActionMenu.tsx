import { css } from "@emotion/react";
import { useState } from "react";
import { useNavigate } from "react-router";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useNotifySuccess } from "@phoenix/contexts";
import { DatasetFromJSONLForm } from "@phoenix/pages/datasets/DatasetFromJSONLForm";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { DatasetFromCSVForm } from "./DatasetFromCSVForm";

type CreateDatasetActionMenuProps = {
  onDatasetCreated: () => void;
};

type DatasetCreationTab = "fromFile" | "fromScratch";
type DatasetFileFormat = "csv" | "jsonl";

function DatasetFromFileForm({
  onDatasetCreated,
  onDatasetCreateError,
}: {
  onDatasetCreated: (newDataset: { id: string; name: string }) => void;
  onDatasetCreateError: (error: Error) => void;
}) {
  const [fileFormat, setFileFormat] = useState<DatasetFileFormat>("csv");
  return (
    <div
      css={css`
        position: relative;
      `}
    >
      <div
        css={css`
          position: absolute;
          top: var(--global-dimension-size-200);
          right: var(--global-dimension-size-200);
        `}
      >
        <ToggleButtonGroup
          size="S"
          selectedKeys={[fileFormat]}
          aria-label="Dataset file format"
          onSelectionChange={(selection) => {
            if (selection.size === 0) {
              return;
            }
            const nextFormat = selection.keys().next().value;
            if (nextFormat === "csv" || nextFormat === "jsonl") {
              setFileFormat(nextFormat);
            }
          }}
        >
          <ToggleButton id="csv">CSV</ToggleButton>
          <ToggleButton id="jsonl">JSONL</ToggleButton>
        </ToggleButtonGroup>
      </div>
      {fileFormat === "csv" ? (
        <DatasetFromCSVForm
          onDatasetCreated={onDatasetCreated}
          onDatasetCreateError={onDatasetCreateError}
        />
      ) : (
        <DatasetFromJSONLForm
          onDatasetCreated={onDatasetCreated}
          onDatasetCreateError={onDatasetCreateError}
        />
      )}
    </div>
  );
}

export function NewDatasetActionMenu({
  onDatasetCreated,
}: CreateDatasetActionMenuProps) {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] =
    useState<DatasetCreationTab>("fromFile");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handleDatasetCreated = (newDataset: { id: string; name: string }) => {
    notifySuccess({
      title: "Dataset created",
      message: `${newDataset.name} has been successfully created.`,
      action: {
        text: "Go to Dataset",
        onClick: () => {
          navigate(`/datasets/${newDataset.id}`);
        },
      },
    });
    setErrorMessage(null);
    setIsOpen(false);
    onDatasetCreated();
  };
  const handleDatasetCreateError = (error: Error) => {
    const formattedError = getErrorMessagesFromRelayMutationError(error);
    setErrorMessage(formattedError?.[0] ?? error.message);
  };
  return (
    <StopPropagation>
      <Button
        variant="primary"
        size="M"
        leadingVisual={<Icon svg={<Icons.DatabaseOutline />} />}
        onPress={() => setIsOpen(true)}
        css={css`
          height: calc(var(--global-button-height-m) + var(--global-dimension-size-50));
          padding: var(--global-dimension-static-size-150)
            var(--global-dimension-static-size-250);
          font-size: var(--global-dimension-static-font-size-200);
        `}
        aria-label="Create a new dataset"
      >
        New Dataset
      </Button>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setErrorMessage(null);
          }
          if (open) {
            setSelectedTab("fromFile");
          }
        }}
      >
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Dataset</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => {
                  const nextTab = String(key);
                  if (nextTab === "fromFile" || nextTab === "fromScratch") {
                    setSelectedTab(nextTab);
                  }
                }}
              >
                {errorMessage ? (
                  <Alert
                    variant="danger"
                    banner
                    css={css`
                      margin-bottom: var(--global-dimension-size-200);
                    `}
                  >
                    {errorMessage}
                  </Alert>
                ) : null}
                <TabList>
                  <Tab id="fromFile">From file</Tab>
                  <Tab id="fromScratch">From scratch</Tab>
                </TabList>
                <TabPanel id="fromFile">
                  <DatasetFromFileForm
                    onDatasetCreated={handleDatasetCreated}
                    onDatasetCreateError={handleDatasetCreateError}
                  />
                </TabPanel>
                <TabPanel id="fromScratch">
                  <CreateDatasetForm
                    onDatasetCreated={handleDatasetCreated}
                    onDatasetCreateError={handleDatasetCreateError}
                  />
                </TabPanel>
              </Tabs>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </StopPropagation>
  );
}
