import { Suspense, useState } from "react";

import { ActionMenu, Item } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Popover,
  PopoverArrow,
  Text,
} from "@phoenix/components";
import { DatasetLabelSelectionContent } from "@phoenix/components/dataset/DatasetLabelConfigButton";

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
  LABELS = "configureLabels",
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
  const [isLabelsOpen, setIsLabelsOpen] = useState(false);

  return (
    <>
      <div
        // TODO: add this logic to the ActionMenu component
        onClick={(e) => {
          // prevent parent anchor link from being followed
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{ position: "relative" }}
      >
        {/* Action Menu for Edit, Labels, and Delete */}
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
              case DatasetAction.LABELS:
                setIsLabelsOpen(true);
                break;
            }
          }}
        >
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
          <Item key={DatasetAction.LABELS}>
            <Flex
              direction={"row"}
              gap="size-75"
              justifyContent={"start"}
              alignItems={"center"}
            >
              <Icon svg={<Icons.PriceTagsOutline />} />
              <Text>Labels</Text>
            </Flex>
          </Item>
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
        </ActionMenu>

        {/* Invisible anchor positioned over ActionMenu button for popover positioning */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            pointerEvents: "none",
          }}
        >
          <DialogTrigger isOpen={isLabelsOpen} onOpenChange={setIsLabelsOpen}>
            <Button
              variant="quiet"
              size="S"
              aria-label="Configure dataset labels"
              style={{
                visibility: "hidden",
                pointerEvents: "none",
              }}
            >
              <Icon svg={<Icons.SettingsOutline />} />
            </Button>
            <Popover placement="bottom end">
              <PopoverArrow />
              <Dialog>
                <Suspense fallback={<Loading />}>
                  <DatasetLabelSelectionContent
                    datasetId={datasetId}
                    onClose={() => setIsLabelsOpen(false)}
                  />
                </Suspense>
              </Dialog>
            </Popover>
          </DialogTrigger>
        </div>
      </div>

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
    </>
  );
}
