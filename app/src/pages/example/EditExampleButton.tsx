import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";

import type { EditExampleDialogProps } from "./EditExampleDialog";
import { EditExampleDialog } from "./EditExampleDialog";

type EditExampleButtonProps = EditExampleDialogProps;

export function EditExampleButton(props: EditExampleButtonProps) {
  const { onCompleted, ...dialogProps } = props;
  return (
    <DialogTrigger>
      <Button size="S" leadingVisual={<Icon svg={<Icons.Edit />} />}>
        Edit Example
      </Button>
      <ViewportModalOverlay>
        <ViewportModal size="L">
          <EditExampleDialog
            {...dialogProps}
            onCompleted={() => {
              onCompleted();
            }}
          />
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
