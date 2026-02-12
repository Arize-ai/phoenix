import { useState } from "react";
import { useNavigate } from "react-router";

import {
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
  View,
} from "@phoenix/components";
import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { DatasetFromJSONLForm } from "@phoenix/pages/datasets/DatasetFromJSONLForm";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { DatasetFromCSVForm } from "./DatasetFromCSVForm";

type CreateDatasetActionMenuProps = {
  onDatasetCreated: () => void;
};

type FileFormat = "csv" | "jsonl";

export function NewDatasetActionMenu({
  onDatasetCreated,
}: CreateDatasetActionMenuProps) {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [createDatasetDialogOpen, setCreateDatasetDialogOpen] = useState(false);
  const [fileFormat, setFileFormat] = useState<FileFormat>("csv");

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
    setCreateDatasetDialogOpen(false);
    onDatasetCreated();
  };

  const handleDatasetCreateError = (error: Error) => {
    const formattedError = getErrorMessagesFromRelayMutationError(error);
    notifyError({
      title: "Dataset creation failed",
      message: formattedError?.[0] ?? error.message,
    });
  };

  return (
    <StopPropagation>
      <Button
        variant="primary"
        size="M"
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        onPress={() => {
          setCreateDatasetDialogOpen(true);
        }}
      >
        Create Dataset
      </Button>
      <ModalOverlay
        isOpen={createDatasetDialogOpen}
        onOpenChange={setCreateDatasetDialogOpen}
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
              <Tabs defaultSelectedKey="fromFile">
                <TabList>
                  <Tab id="fromFile">From file</Tab>
                  <Tab id="fromScratch">From scratch</Tab>
                </TabList>
                <TabPanel id="fromFile">
                  <View padding="size-200">
                    <ToggleButtonGroup
                      aria-label="File format"
                      selectedKeys={[fileFormat]}
                      onSelectionChange={(v) => {
                        if (v.size === 0) {
                          return;
                        }
                        const selected = v.keys().next().value;
                        if (selected === "csv" || selected === "jsonl") {
                          setFileFormat(selected);
                        }
                      }}
                    >
                      <ToggleButton id="csv" aria-label="CSV">
                        CSV
                      </ToggleButton>
                      <ToggleButton id="jsonl" aria-label="JSONL">
                        JSONL
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </View>
                  {fileFormat === "csv" ? (
                    <DatasetFromCSVForm
                      onDatasetCreated={handleDatasetCreated}
                      onDatasetCreateError={handleDatasetCreateError}
                    />
                  ) : (
                    <DatasetFromJSONLForm
                      onDatasetCreated={handleDatasetCreated}
                      onDatasetCreateError={handleDatasetCreateError}
                    />
                  )}
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
