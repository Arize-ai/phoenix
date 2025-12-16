import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
} from "@phoenix/components";

export function ModelParametersConfigButton() {
  return (
    <DialogTrigger>
      <Button
        variant="default"
        size="S"
        aria-label="Configure model parameters"
        leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
      />
      <Popover>
        <PopoverArrow />
        <Dialog>Parameters</Dialog>
      </Popover>
    </DialogTrigger>
  );
}
