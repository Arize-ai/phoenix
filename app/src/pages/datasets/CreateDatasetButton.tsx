import { css } from "@emotion/react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@phoenix/components";
import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
import { useNotifySuccess } from "@phoenix/contexts";

import {
  DatasetFromFileForm,
  type DatasetUploadSummary,
} from "./DatasetFromFileForm";

const dialogCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
`;

type CreateDatasetButtonProps = {
  onDatasetCreated: () => void;
};

export function CreateDatasetButton({
  onDatasetCreated,
}: CreateDatasetButtonProps) {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const [isOpen, setIsOpen] = useState(false);

  const handleDatasetCreatedFromFile = useCallback(
    (newDataset: { id: string; name: string } & DatasetUploadSummary) => {
      let message: string;
      if (!newDataset.newVersionCreated) {
        message = "No examples changed.";
      } else {
        const formatPart = (count: number, verb: string) =>
          `${count} ${count === 1 ? "example was" : "examples were"} ${verb}`;
        const parts: string[] = [];
        if (newDataset.numCreatedExamples > 0) {
          parts.push(formatPart(newDataset.numCreatedExamples, "added"));
        }
        if (newDataset.numPatchedExamples > 0) {
          parts.push(formatPart(newDataset.numPatchedExamples, "updated"));
        }
        if (newDataset.numDeletedExamples > 0) {
          parts.push(formatPart(newDataset.numDeletedExamples, "deleted"));
        }
        if (parts.length === 0) {
          message = "A new dataset version was created.";
        } else {
          const joined = parts.join(", ") + ".";
          message = joined.charAt(0).toUpperCase() + joined.slice(1);
        }
      }
      notifySuccess({
        title: "Dataset created",
        message,
        action: {
          text: "Go to Dataset",
          onClick: () => {
            navigate(`/datasets/${newDataset.id}`);
          },
        },
      });
      setIsOpen(false);
      onDatasetCreated();
    },
    [navigate, notifySuccess, onDatasetCreated]
  );

  const handleDatasetCreatedFromScratch = useCallback(
    (newDataset: { id: string; name: string }) => {
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
      setIsOpen(false);
      onDatasetCreated();
    },
    [navigate, notifySuccess, onDatasetCreated]
  );

  const handleCancel = useCallback(() => setIsOpen(false), []);

  return (
    <DialogTrigger onOpenChange={setIsOpen} isOpen={isOpen}>
      <Button
        variant="primary"
        size="M"
        leadingVisual={<Icon svg={<Icons.DatabaseOutline />} />}
        onPress={() => setIsOpen(true)}
        aria-label="Create a new dataset"
      >
        New Dataset
      </Button>
      <ModalOverlay isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal variant="slideover" size="fullscreen">
          <Dialog css={dialogCSS}>
            <DialogHeader>
              <DialogTitle>Create Dataset</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton slot="close" />
              </DialogTitleExtra>
            </DialogHeader>
            <DialogContent
              css={css`
                height: auto;
                flex: 1 1 auto;
                min-height: 0;
              `}
            >
              <Tabs>
                <TabList>
                  <Tab id="fromFile">From file</Tab>
                  <Tab id="fromScratch">From scratch</Tab>
                </TabList>
                <TabPanel
                  id="fromFile"
                  css={css`
                    flex: 1;
                    min-height: 0;
                  `}
                >
                  <DatasetFromFileForm
                    mode="create"
                    onDatasetCreated={handleDatasetCreatedFromFile}
                    onCancel={handleCancel}
                  />
                </TabPanel>
                <TabPanel id="fromScratch">
                  <CreateDatasetForm
                    onDatasetCreated={handleDatasetCreatedFromScratch}
                    onCancel={handleCancel}
                  />
                </TabPanel>
              </Tabs>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
