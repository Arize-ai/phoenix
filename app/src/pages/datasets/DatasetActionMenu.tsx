import { Suspense, useState } from "react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  PopoverArrow,
  Text,
} from "@phoenix/components";
import { DatasetLabelSelectionContent } from "@phoenix/components/dataset/DatasetLabelConfigButton";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

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
  const datasetSplitsEnabled = useFeatureFlag("datasetLabel");
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
  const [isLabelOpen, setIsLabelOpen] = useState(false);

  return (
    <StopPropagation>
      <div style={{ position: "relative" }}>
        <MenuTrigger>
          <Button
            size="S"
            leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
          />
          <Popover>
            <Menu
              onAction={(action) => {
                switch (action) {
                  case DatasetAction.DELETE:
                    setIsDeleteOpen(true);
                    break;
                  case DatasetAction.EDIT:
                    setIsEditOpen(true);
                    break;
                  case DatasetAction.LABELS:
                    setIsLabelOpen(true);
                    break;
                }
              }}
            >
              <MenuItem id={DatasetAction.EDIT}>
                <Flex
                  direction={"row"}
                  gap="size-75"
                  justifyContent={"start"}
                  alignItems={"center"}
                >
                  <Icon svg={<Icons.Edit2Outline />} />
                  <Text>Edit</Text>
                </Flex>
              </MenuItem>
              {datasetSplitsEnabled && (
                <MenuItem id={DatasetAction.LABELS}>
                  <Flex
                    direction={"row"}
                    gap="size-75"
                    justifyContent={"start"}
                    alignItems={"center"}
                  >
                    <Icon svg={<Icons.PriceTagsOutline />} />
                    <Text>Label</Text>
                  </Flex>
                </MenuItem>
              )}
              <MenuItem id={DatasetAction.DELETE}>
                <Flex
                  direction={"row"}
                  gap="size-75"
                  justifyContent={"start"}
                  alignItems={"center"}
                >
                  <Icon svg={<Icons.TrashOutline />} />
                  <Text>Delete</Text>
                </Flex>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>

        {/* Invisible anchor positioned over Menu button for popover positioning */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            pointerEvents: "none",
          }}
        >
          <DialogTrigger isOpen={isLabelOpen} onOpenChange={setIsLabelOpen}>
            <Button
              size="S"
              style={{
                visibility: "hidden",
                pointerEvents: "none",
              }}
            />
            <Popover placement="bottom end">
              <PopoverArrow />
              <Dialog>
                <Suspense fallback={<Loading />}>
                  <DatasetLabelSelectionContent datasetId={datasetId} />
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
    </StopPropagation>
  );
}
