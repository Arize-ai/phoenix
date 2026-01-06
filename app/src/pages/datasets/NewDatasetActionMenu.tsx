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
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
} from "@phoenix/components";
import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { DatasetFromCSVForm } from "./DatasetFromCSVForm";

type CreateDatasetActionMenuProps = {
  onDatasetCreated: () => void;
};

enum CreateDatasetAction {
  NEW = "newDataset",
  FROM_CSV = "datasetFromCSV",
}

export function NewDatasetActionMenu({
  onDatasetCreated,
}: CreateDatasetActionMenuProps) {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [createDatasetDialogOpen, setCreateDatasetDialogOpen] = useState(false);
  const [datasetFromCSVDialogOpen, setDatasetFromCSVDialogOpen] =
    useState(false);
  const onCreateDataset = () => {
    setCreateDatasetDialogOpen(true);
  };
  const onCreateDatasetFromCSV = () => {
    setDatasetFromCSVDialogOpen(true);
  };
  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          variant="primary"
          size="M"
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        >
          New Dataset
        </Button>
        <Popover>
          <Menu
            onAction={(action) => {
              switch (action) {
                case CreateDatasetAction.NEW:
                  onCreateDataset();
                  break;
                case CreateDatasetAction.FROM_CSV:
                  onCreateDatasetFromCSV();
                  break;
              }
            }}
          >
            <MenuItem id={CreateDatasetAction.NEW}>New Dataset</MenuItem>
            <MenuItem id={CreateDatasetAction.FROM_CSV}>
              Dataset from CSV
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <ModalOverlay
        isOpen={createDatasetDialogOpen}
        onOpenChange={setCreateDatasetDialogOpen}
      >
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Dataset</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <CreateDatasetForm
                onDatasetCreated={(newDataset) => {
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
                }}
                onDatasetCreateError={(error) => {
                  const formattedError =
                    getErrorMessagesFromRelayMutationError(error);
                  notifyError({
                    title: "Dataset creation failed",
                    message: formattedError?.[0] ?? error.message,
                  });
                }}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
      <ModalOverlay
        isOpen={datasetFromCSVDialogOpen}
        onOpenChange={setDatasetFromCSVDialogOpen}
      >
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Dataset from CSV</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <DatasetFromCSVForm
                onDatasetCreated={(newDataset) => {
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
                  setDatasetFromCSVDialogOpen(false);
                  onDatasetCreated();
                }}
                onDatasetCreateError={(error) => {
                  const formattedError =
                    getErrorMessagesFromRelayMutationError(error);
                  notifyError({
                    title: "Dataset creation failed",
                    message: formattedError?.[0] ?? error.message,
                  });
                }}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </StopPropagation>
  );
}
