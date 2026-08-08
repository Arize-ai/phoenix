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
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
  ViewportModal,
  ViewportModalOverlay,
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

enum ExamplesAction {
  UPDATE_FROM_FILE = "update-from-file",
  ADD_MANUALLY = "add-manually",
}

type AddDatasetExampleButtonProps = {
  datasetId: string;
  datasetName: string;
  onAddExampleCompleted: () => void;
};

export function AddDatasetExampleButton(props: AddDatasetExampleButtonProps) {
  const { datasetId, datasetName, onAddExampleCompleted } = props;
  const [isFromFileOpen, setIsFromFileOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const notifySuccess = useNotifySuccess();

  const handleManualExampleAdded = useCallback(() => {
    notifySuccess({
      title: "Dataset Updated",
      message:
        "The example has been added successfully and the version has been updated.",
    });
    onAddExampleCompleted();
  }, [notifySuccess, onAddExampleCompleted]);

  const handleFileUploadCompleted = useCallback(
    (summary: DatasetUploadSummary) => {
      const totalChanged =
        summary.numCreatedExamples +
        summary.numPatchedExamples +
        summary.numDeletedExamples;
      let message: string;
      if (totalChanged === 0) {
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
        const joined = parts.join(", ") + ".";
        message = joined.charAt(0).toUpperCase() + joined.slice(1);
      }
      notifySuccess({
        title: totalChanged > 0 ? "Dataset Updated" : "Dataset Unchanged",
        message,
      });
      onAddExampleCompleted();
      setIsFromFileOpen(false);
    },
    [notifySuccess, onAddExampleCompleted]
  );

  const handleFileCancel = useCallback(() => setIsFromFileOpen(false), []);

  return (
    <>
      <MenuTrigger>
        <Button
          leadingVisual={<Icon svg={<Icons.Plus />} />}
          size="M"
          aria-label="Add Dataset Example"
          variant="primary"
        >
          Examples
        </Button>
        <Popover placement="bottom end">
          <Menu
            onAction={(action) => {
              switch (action) {
                case ExamplesAction.UPDATE_FROM_FILE:
                  setIsFromFileOpen(true);
                  break;
                case ExamplesAction.ADD_MANUALLY:
                  setIsManualOpen(true);
                  break;
              }
            }}
          >
            <MenuItem id={ExamplesAction.UPDATE_FROM_FILE}>
              <Flex direction="row" gap="size-100" alignItems="center">
                <Icon svg={<Icons.File />} />
                <Text>Update Dataset From File</Text>
              </Flex>
            </MenuItem>
            <MenuItem id={ExamplesAction.ADD_MANUALLY}>
              <Flex direction="row" gap="size-100" alignItems="center">
                <Icon svg={<Icons.Edit />} />
                <Text>Add Example Manually</Text>
              </Flex>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <DialogTrigger isOpen={isFromFileOpen} onOpenChange={setIsFromFileOpen}>
        <ViewportModalOverlay
          isOpen={isFromFileOpen}
          onOpenChange={setIsFromFileOpen}
        >
          <ViewportModal size="fullscreen">
            <Dialog css={dialogCSS}>
              <DialogHeader>
                <DialogTitle>Update Dataset From File</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <DialogContent css={contentCSS}>
                <DatasetFromFileForm
                  mode="append"
                  datasetName={datasetName}
                  onExamplesAdded={handleFileUploadCompleted}
                  onCancel={handleFileCancel}
                />
              </DialogContent>
            </Dialog>
          </ViewportModal>
        </ViewportModalOverlay>
      </DialogTrigger>
      <DialogTrigger isOpen={isManualOpen} onOpenChange={setIsManualOpen}>
        <ViewportModalOverlay
          isOpen={isManualOpen}
          onOpenChange={setIsManualOpen}
        >
          <ViewportModal size="L">
            <Dialog css={dialogCSS}>
              {({ close }) => (
                <>
                  <DialogHeader>
                    <DialogTitle>Add Example Manually</DialogTitle>
                    <DialogTitleExtra>
                      <DialogCloseButton slot="close" />
                    </DialogTitleExtra>
                  </DialogHeader>
                  <DialogContent css={contentCSS}>
                    <AddExampleFromScratchForm
                      datasetId={datasetId}
                      onExampleAdded={handleManualExampleAdded}
                      close={close}
                    />
                  </DialogContent>
                </>
              )}
            </Dialog>
          </ViewportModal>
        </ViewportModalOverlay>
      </DialogTrigger>
    </>
  );
}
