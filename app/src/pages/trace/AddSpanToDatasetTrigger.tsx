import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

export function AddSpanToDatasetTrigger({
  buttonText,
}: {
  buttonText: string | null;
}) {
  return (
    <TooltipTrigger delay={0} isDisabled={buttonText !== null}>
      <Button
        aria-label="Add to Dataset"
        variant="default"
        size="S"
        leadingVisual={<Icon svg={<Icons.Database />} />}
      >
        {buttonText}
      </Button>
      <Tooltip>Add to Dataset</Tooltip>
    </TooltipTrigger>
  );
}
