import { useState } from "react";

import { ActionMenu, Item } from "@arizeai/components";

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
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

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
              setIsDeleteOpen(true);
              break;
            case DatasetAction.EDIT:
              setIsEditOpen(true);
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

      {/* Delete Dataset Dialog */}
      <DeleteDatasetDialog
        datasetId={datasetId}
        datasetName={datasetName}
        onDatasetDelete={onDatasetDelete}
        onDatasetDeleteError={onDatasetDeleteError}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />

      {/* Edit Dataset Dialog */}
      <EditDatasetDialog
        datasetId={datasetId}
        datasetName={datasetName}
        datasetDescription={datasetDescription}
        datasetMetadata={datasetMetadata}
        onDatasetEdited={onDatasetEdit}
        onDatasetEditError={onDatasetEditError}
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </div>
  );
}
