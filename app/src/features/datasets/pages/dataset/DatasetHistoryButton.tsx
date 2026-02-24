import { Suspense, useState } from "react";

import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { DatasetHistoryDialog } from "./DatasetHistoryDialog";

export function DatasetHistoryButton(props: { datasetId: string }) {
  const { datasetId } = props;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TooltipTrigger delay={100}>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.ClockOutline />} />}
          aria-label="Version History"
          onPress={() => setIsOpen(true)}
        />
        <Tooltip>
          <TooltipArrow />
          Dataset Version History
        </Tooltip>
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
