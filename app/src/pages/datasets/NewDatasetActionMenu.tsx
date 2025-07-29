import { ReactNode, useState } from "react";
import { useNavigate } from "react-router";

// eslint-disable-next-line deprecate/import
import { ActionMenu, Dialog, DialogContainer, Item } from "@arizeai/components";

import { Icon, Icons } from "@phoenix/components";
import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
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
  const [dialog, setDialog] = useState<ReactNode>(null);
  const onCreateDataset = () => {
    setDialog(
      <Dialog size="S" title="New Dataset">
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
            setDialog(null);
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
      </Dialog>
    );
  };
  const onCreateDatasetFromCSV = () => {
    setDialog(
      <Dialog size="M" title="New Dataset from CSV">
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
            setDialog(null);
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
      </Dialog>
    );
  };
  return (
    <>
      <ActionMenu
        buttonText="Create Dataset"
        align="end"
        icon={<Icon svg={<Icons.DatabaseOutline />} />}
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
        <Item key={CreateDatasetAction.NEW}>New Dataset</Item>
        <Item key={CreateDatasetAction.FROM_CSV}>Dataset from CSV</Item>
      </ActionMenu>
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}
