import { ReactNode, useCallback, useState } from "react";

import { ActionMenu, DialogContainer, Item } from "@arizeai/components";

import { Flex, Icon, Icons, Text } from "@phoenix/components";

import { DeleteDatasetDialog } from "./DeleteDatasetDialog";
import { EditDatasetDialog } from "./EditDatasetDialog";
type DatasetActionMenuProps = {
  datasetId: string;
  datasetName: string;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onDatasetDelete: () => void;
  onDatasetDeleteError: (error: Error) => void;
  onDatasetEdit: () => void;
  onDatasetEditError: (error: Error) => void;
};

enum DatasetAction {
  DELETE = "deleteDataset",
  EDIT = "editDataset",
}

export function DatasetActionMenu(props: DatasetActionMenuProps) {
  const {
    datasetId,
    datasetName,
    datasetDescription,
    datasetMetadata,
    onDatasetDelete,
    onDatasetDeleteError,
    onDatasetEdit,
    onDatasetEditError,
  } = props;
  const [dialog, setDialog] = useState<ReactNode>(null);

  const onDelete = useCallback(() => {
    setDialog(
      <DeleteDatasetDialog
        datasetId={datasetId}
        datasetName={datasetName}
        onDatasetDelete={() => {
          onDatasetDelete();
          setDialog(null);
        }}
        onDatasetDeleteError={onDatasetDeleteError}
      />
    );
  }, [datasetId, datasetName, onDatasetDelete, onDatasetDeleteError]);

  const onEdit = useCallback(() => {
    setDialog(
      <EditDatasetDialog
        datasetId={datasetId}
        datasetName={datasetName}
        datasetDescription={datasetDescription}
        datasetMetadata={datasetMetadata}
        onDatasetEdited={() => {
          onDatasetEdit();
          setDialog(null);
        }}
        onDatasetEditError={onDatasetEditError}
      />
    );
  }, [
    datasetDescription,
    datasetId,
    datasetMetadata,
    datasetName,
    onDatasetEdit,
    onDatasetEditError,
  ]);
  return (
    <div
      // TODO: add this logic to the ActionMenu component
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ActionMenu
        align="end"
        buttonSize="compact"
        onAction={(action) => {
          switch (action) {
            case DatasetAction.DELETE:
              onDelete();
              break;
            case DatasetAction.EDIT:
              onEdit();
              break;
          }
        }}
      >
        <Item key={DatasetAction.DELETE}>
          <Flex
            direction={"row"}
            gap="size-75"
            justifyContent={"start"}
            alignItems={"center"}
          >
            <Icon svg={<Icons.TrashOutline />} />
            <Text>Delete</Text>
          </Flex>
        </Item>
        <Item key={DatasetAction.EDIT}>
          <Flex
            direction={"row"}
            gap="size-75"
            justifyContent={"start"}
            alignItems={"center"}
          >
            <Icon svg={<Icons.Edit2Outline />} />
            <Text>Edit</Text>
          </Flex>
        </Item>
      </ActionMenu>
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </div>
  );
}
