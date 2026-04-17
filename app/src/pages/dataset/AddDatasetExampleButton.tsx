import { css } from "@emotion/react";
import { useCallback, useState } from "react";

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
import { useNotifySuccess } from "@phoenix/contexts";
import {
  DatasetFromFileForm,
  type DatasetUploadSummary,
} from "@phoenix/pages/datasets/DatasetFromFileForm";

import { AddExampleFromScratchForm } from "./AddExampleFromScratchForm";

const dialogCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
`;

const contentCSS = css`
  height: auto;
  flex: 1 1 auto;
  min-height: 0;
`;

const tabPanelCSS = css`
  flex: 1;
  min-height: 0;
`;

type AddDatasetExampleButtonProps = {
  datasetId: string;
  datasetName: string;
  onAddExampleCompleted: () => void;
};

export function AddDatasetExampleButton(props: AddDatasetExampleButtonProps) {
  const { datasetId, datasetName, onAddExampleCompleted } = props;
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();

  const handleCompleted = useCallback(() => {
    notifySuccess({
      title: "Dataset Updated",
      message:
        "The example has been added successfully and the version has been updated.",
    });
    onAddExampleCompleted();
  }, [notifySuccess, onAddExampleCompleted]);

  const handleFileCompleted = useCallback(
    (summary: DatasetUploadSummary) => {
      let message: string;
      if (!summary.newVersionCreated) {
        message = "No examples were changed.";
      } else {
        const formatPart = (count: number, verb: string) =>
          `${count} ${count === 1 ? "example was" : "examples were"} ${verb}`;
        const parts: string[] = [];
        if (summary.numCreatedExamples > 0) {
          parts.push(formatPart(summary.numCreatedExamples, "added"));
        }
        if (summary.numPatchedExamples > 0) {
          parts.push(formatPart(summary.numPatchedExamples, "updated"));
        }
        if (summary.numDeletedExamples > 0) {
          parts.push(formatPart(summary.numDeletedExamples, "deleted"));
        }
        if (parts.length === 0) {
          message = "A new dataset version was created.";
        } else {
          const joined = parts.join(", ") + ".";
          message = joined.charAt(0).toUpperCase() + joined.slice(1);
        }
      }
      notifySuccess({
        title: summary.newVersionCreated ? "Dataset Updated" : "No Changes",
        message,
      });
      onAddExampleCompleted();
      setIsOpen(false);
    },
    [notifySuccess, onAddExampleCompleted]
  );

  const handleCancel = useCallback(() => setIsOpen(false), []);

  return (
    <DialogTrigger onOpenChange={setIsOpen} isOpen={isOpen}>
      <Button
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        size="M"
        aria-label="Add Dataset Example"
        variant="primary"
        onPress={() => setIsOpen(true)}
      >
        Examples
      </Button>
      <ModalOverlay isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal variant="slideover" size="fullscreen">
          <Dialog css={dialogCSS}>
            {({ close }) => (
              <>
                <DialogHeader>
                  <DialogTitle>Add Examples</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton slot="close" />
                  </DialogTitleExtra>
                </DialogHeader>
                <DialogContent css={contentCSS}>
                  <Tabs>
                    <TabList>
                      <Tab id="fromFile">From file</Tab>
                      <Tab id="fromScratch">From scratch</Tab>
                    </TabList>
                    <TabPanel id="fromFile" css={tabPanelCSS}>
                      <DatasetFromFileForm
                        mode="append"
                        datasetName={datasetName}
                        onExamplesAdded={handleFileCompleted}
                        onCancel={handleCancel}
                      />
                    </TabPanel>
                    <TabPanel id="fromScratch">
                      <AddExampleFromScratchForm
                        datasetId={datasetId}
                        onExampleAdded={handleCompleted}
                        close={close}
                      />
                    </TabPanel>
                  </Tabs>
                </DialogContent>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
