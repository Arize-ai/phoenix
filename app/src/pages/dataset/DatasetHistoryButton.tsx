import { ReactNode, Suspense, useState } from "react";

import { DialogContainer, Tooltip, TooltipTrigger } from "@arizeai/components";

import { Button, Icon, Icons } from "@phoenix/components";

import { DatasetHistoryDialog } from "./DatasetHistoryDialog";

export function DatasetHistoryButton(props: { datasetId: string }) {
  const { datasetId } = props;
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <>
      <TooltipTrigger>
        <Button
          leadingVisual={<Icon svg={<Icons.ClockOutline />} />}
          aria-label="Version History"
          onPress={() => {
            setDialog(<DatasetHistoryDialog datasetId={datasetId} />);
          }}
        />
        <Tooltip>Dataset Version History</Tooltip>
      </TooltipTrigger>
      <Suspense fallback={null}>
        <DialogContainer
          type="modal"
          isDismissable
          onDismiss={() => {
            setDialog(null);
          }}
        >
          {dialog}
        </DialogContainer>
      </Suspense>
    </>
  );
}
