import React, { ReactNode, useState } from "react";

import {
  Button,
  ButtonProps,
  DialogContainer,
  Icon,
  Icons,
} from "@arizeai/components";

import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";

export function EditSpanAnnotationsButton({
  spanNodeId,
  projectId,
  size = "default",
}: {
  spanNodeId: string;
  projectId: string;
  /**
   * The size of the button
   * @default default
   */
  size?: ButtonProps["size"];
}) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <>
      <Button
        variant="default"
        size={size}
        icon={<Icon svg={<Icons.EditOutline />} />}
        onClick={() =>
          setDialog(
            <EditSpanAnnotationsDialog
              spanNodeId={spanNodeId}
              projectId={projectId}
            />
          )
        }
      >
        Annotate
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
