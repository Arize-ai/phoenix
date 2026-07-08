import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { SubmenuTrigger } from "react-aria-components";

import {
  Button,
  Dialog,
  Flex,
  Icon,
  Icons,
  Loading,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  PopoverArrow,
  Text,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { DatasetLabelSelectionContent } from "@phoenix/components/dataset/DatasetLabelConfigButton";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useViewerCanManageAccessControl } from "@phoenix/contexts";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";

import { DatasetAccessPageContent } from "./DatasetAccessPage";
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
  MANAGE_ACCESS = "manageAccess",
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
  const canManageAccessControl = useViewerCanManageAccessControl();
  const { accessControlEnabled } = useFunctionality();
  const canShowManageAccess = accessControlEnabled && canManageAccessControl;
  const [showManageAccessDialog, setShowManageAccessDialog] = useState(false);
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
                case DatasetAction.MANAGE_ACCESS:
                  setShowManageAccessDialog(true);
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
              <Popover
                placement="start top"
                css={css`
                  min-width: 300px;
                  width: 300px;
                `}
              >
                <PopoverArrow />
                <Suspense
                  fallback={
                    <Loading
                      css={css`
                        min-width: 300px;
                        min-height: 100px;
                      `}
                    />
                  }
                >
                  <DatasetLabelSelectionContent datasetId={datasetId} />
                </Suspense>
              </Popover>
            </SubmenuTrigger>
            {canShowManageAccess ? (
              <MenuItem
                id={DatasetAction.MANAGE_ACCESS}
                textValue="Manage access"
              >
                <Flex
                  direction={"row"}
                  gap="size-75"
                  justifyContent={"start"}
                  alignItems={"center"}
                >
                  <Icon svg={<Icons.Shield />} />
                  <Text>Manage Access</Text>
                </Flex>
              </MenuItem>
            ) : null}
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
        </Popover>
      </MenuTrigger>

      <ModalOverlay
        isOpen={showManageAccessDialog}
        onOpenChange={setShowManageAccessDialog}
      >
        <Modal variant="slideover" size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage Access</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <Suspense fallback={<Loading />}>
                <DatasetAccessPageContent datasetId={datasetId} />
              </Suspense>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>

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
