import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { SubmenuTrigger } from "react-aria-components";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Loading,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
  Text,
} from "@phoenix/components";
import { DatasetLabelSelectionContent } from "@phoenix/components/dataset/DatasetLabelConfigButton";
import { StopPropagation } from "@phoenix/components/StopPropagation";

import { DeleteDatasetDialog } from "./DeleteDatasetDialog";
import { EditDatasetDialog } from "./EditDatasetDialog";
type DatasetActionMenuProps = {
  datasetId: string;
  datasetName: string;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onDatasetDelete: () => void;
  onDatasetEdit: () => void;
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
    onDatasetEdit,
  } = props;
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          aria-label="Dataset actions"
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
        />
        <MenuContainer size="xs" minHeight={0} shouldFlip>
          <Menu
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
            <MenuItem id={DatasetAction.EDIT}>
              <Flex
                direction={"row"}
                gap="size-75"
                justifyContent={"start"}
                alignItems={"center"}
              >
                <Icon svg={<Icons.Edit2 />} />
                <Text>Edit</Text>
              </Flex>
            </MenuItem>
            <SubmenuTrigger>
              <MenuItem id={DatasetAction.LABELS}>
                <Flex
                  direction={"row"}
                  gap="size-75"
                  justifyContent={"start"}
                  alignItems={"center"}
                >
                  <Icon svg={<Icons.PriceTags />} />
                  <Text>Label</Text>
                </Flex>
              </MenuItem>
              <MenuContainer
                size="sm"
                minHeight={0}
                placement="start top"
                shouldFlip
              >
                <Suspense
                  fallback={
                    <Loading
                      css={css`
                        min-width: var(--global-menu-width-xs);
                        min-height: 100px;
                      `}
                    />
                  }
                >
                  <DatasetLabelSelectionContent datasetId={datasetId} />
                </Suspense>
              </MenuContainer>
            </SubmenuTrigger>
            <MenuItem id={DatasetAction.DELETE}>
              <Flex
                direction={"row"}
                gap="size-75"
                justifyContent={"start"}
                alignItems={"center"}
              >
                <Icon svg={<Icons.Trash />} />
                <Text>Delete</Text>
              </Flex>
            </MenuItem>
          </Menu>
        </MenuContainer>
      </MenuTrigger>

      {/* Delete Dataset Dialog */}
      <DeleteDatasetDialog
        datasetId={datasetId}
        datasetName={datasetName}
        onDatasetDelete={onDatasetDelete}
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
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </StopPropagation>
  );
}
