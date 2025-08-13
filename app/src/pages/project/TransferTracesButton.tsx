import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Input,
  Popover,
  PopoverArrow,
  SearchField,
  SearchIcon,
  View,
} from "@phoenix/components";

export function TransferTracesButton() {
  return (
    <DialogTrigger>
      <Button leadingVisual={<Icon svg={<Icons.CornerUpRightOutline />} />}>
        Transfer Project
      </Button>
      <Popover>
        <PopoverArrow />
        <Dialog>
          <ProjectSelection />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function ProjectSelection() {
  return (
    <View minWidth={400} minHeight={500} padding="size-100">
      <SearchField>
        <SearchIcon />
        <Input placeholder="Search Projects" />
      </SearchField>
    </View>
  );
}
