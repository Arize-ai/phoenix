import React, { ReactNode, useState } from "react";

import { Button, DialogContainer, Icon, Icons } from "@arizeai/components";

import {
  EditDatasetExampleDialog,
  EditDatasetExampleDialogProps,
} from "./EditDatasetExampleDialog";

type EditDatasetExampleButtonProps = Omit<
  EditDatasetExampleDialogProps,
  "onCompleted"
>;
export function EditDatasetExampleButton(props: EditDatasetExampleButtonProps) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <>
      <Button
        variant="default"
        size="compact"
        icon={<Icon svg={<Icons.EditOutline />} />}
        onClick={() =>
          setDialog(
            <EditDatasetExampleDialog
              {...props}
              onCompleted={() => {
                setDialog(null);
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
