import React, { ReactNode, useState } from "react";

import { Button, DialogContainer, Icon, Icons } from "@arizeai/components";

import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";

export function EditSpanAnnotationsButton(props: {
  spanNodeId: string;
  projectId: string;
}) {
  const { spanNodeId, projectId } = props;
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <>
      <Button
        variant="default"
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
