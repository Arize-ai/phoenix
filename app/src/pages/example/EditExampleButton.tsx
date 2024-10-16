import React, { ReactNode, useState } from "react";

import { Button, DialogContainer, Icon, Icons } from "@arizeai/components";

import { EditExampleDialog, EditExampleDialogProps } from "./EditExampleDialog";

type EditExampleButtonProps = EditExampleDialogProps;
export function EditExampleButton(props: EditExampleButtonProps) {
  const { onCompleted, ...dialogProps } = props;
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <>
      <Button
        variant="default"
        size="compact"
        icon={<Icon svg={<Icons.EditOutline />} />}
        onClick={() =>
          setDialog(
            <EditExampleDialog
              {...dialogProps}
              onCompleted={() => {
                setDialog(null);
                onCompleted();
              }}
            />
          )
        }
      >
        Edit Example
      </Button>
      <DialogContainer
        type="slideOver"
        isDismissable
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}
