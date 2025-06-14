import { Suspense, useState } from "react";

import { Tooltip, TooltipTrigger } from "@arizeai/components";

import { Button, Icon, Icons } from "@phoenix/components";

import { DatasetHistoryDialog } from "./DatasetHistoryDialog";

export function DatasetHistoryButton(props: { datasetId: string }) {
  const { datasetId } = props;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TooltipTrigger>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.ClockOutline />} />}
          aria-label="Version History"
          onPress={() => setIsOpen(true)}
        />
        <Tooltip>Dataset Version History</Tooltip>
      </TooltipTrigger>
      <Suspense fallback={null}>
        <DatasetHistoryDialog
          datasetId={datasetId}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
        />
      </Suspense>
    </>
  );
}
