import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { SubmenuTrigger } from "react-aria-components";

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
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useViewerCanManageAccessControl } from "@phoenix/contexts";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";
import { PromptLabelSelectionContent } from "@phoenix/pages/prompt/PromptLabelConfigButton";

import { DeletePromptDialog } from "./DeletePromptDialog";
import { PromptAccessPageContent } from "./PromptAccessPage";

enum PromptAction {
  MANAGE_ACCESS = "MANAGE_ACCESS",
  DELETE = "DELETE",
  LABELS = "LABELS",
}

export function PromptActionMenu({
  onDeleted,
  promptId,
}: {
  promptId: string;
  onDeleted: () => void;
}) {
  const canManageAccessControl = useViewerCanManageAccessControl();
  const { accessControlEnabled } = useFunctionality();
  const canShowManageAccess = accessControlEnabled && canManageAccessControl;
  const [showManageAccessDialog, setShowManageAccessDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          aria-label="Prompt actions"
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
        />
        <Popover>
          <Menu
            aria-label="Prompt action menu"
            onAction={(action) => {
              switch (action) {
                case PromptAction.MANAGE_ACCESS:
                  setShowManageAccessDialog(true);
                  break;
                case PromptAction.DELETE:
                  setShowDeleteDialog(true);
                  break;
              }
            }}
          >
            <SubmenuTrigger>
              <MenuItem id={PromptAction.LABELS}>
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
                  <PromptLabelSelectionContent promptId={promptId} />
                </Suspense>
              </Popover>
            </SubmenuTrigger>
            {canShowManageAccess ? (
              <MenuItem
                id={PromptAction.MANAGE_ACCESS}
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
            <MenuItem id={PromptAction.DELETE}>
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
                <PromptAccessPageContent promptId={promptId} />
              </Suspense>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
      <DialogTrigger
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <Modal>
          <DeletePromptDialog
            promptId={promptId}
            onDeleted={() => {
              onDeleted();
              setShowDeleteDialog(false);
            }}
          />
        </Modal>
      </DialogTrigger>
    </StopPropagation>
  );
}
