import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";

import { EditExampleDialog, EditExampleDialogProps } from "./EditExampleDialog";

type EditExampleButtonProps = EditExampleDialogProps;

export function EditExampleButton(props: EditExampleButtonProps) {
  const { onCompleted, ...dialogProps } = props;
  return (
    <DialogTrigger>
      <Button size="S" leadingVisual={<Icon svg={<Icons.EditOutline />} />}>
        Edit Example
      </Button>
      <ModalOverlay>
        <Modal variant="slideover" size="L">
          <EditExampleDialog
            {...dialogProps}
            onCompleted={() => {
              onCompleted();
            }}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
