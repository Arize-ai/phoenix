import { ReactNode, useState } from "react";

import { DialogContainer } from "@arizeai/components";

import { Button, ButtonProps, Icon, Icons } from "@phoenix/components";
import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";

export function EditSpanAnnotationsButton({
  spanNodeId,
  projectId,
  size = "M",
  buttonText = "Annotate",
}: {
  spanNodeId: string;
  projectId: string;
  /**
   * The size of the button
   * @default M
   */
  size?: ButtonProps["size"];
  /**
   * The text of the button
   * @default "Annotate"
   */
  buttonText: string | null;
}) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <>
      <Button
        size={size}
        aria-label="Edit Span Annotations"
        leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        onPress={() =>
          setDialog(
            <EditSpanAnnotationsDialog
              spanNodeId={spanNodeId}
              projectId={projectId}
            />
          )
        }
      >
        {buttonText}
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
