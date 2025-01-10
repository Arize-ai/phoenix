import React, { ReactNode, useState } from "react";

import { DialogContainer } from "@arizeai/components";

import { Button, ButtonProps, Icon, Icons } from "@phoenix/components";
import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";

export function EditSpanAnnotationsButton({
  spanNodeId,
  projectId,
  size = "M",
}: {
  spanNodeId: string;
  projectId: string;
  /**
   * The size of the button
   * @default M
   */
  size?: ButtonProps["size"];
}) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <>
      <Button
        size={size}
        icon={<Icon svg={<Icons.EditOutline />} />}
        onPress={() =>
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
