import React from "react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  View,
} from "@phoenix/components";

export function TagPromptVersionButton() {
  return (
    <DialogTrigger>
      <Button size="S" icon={<Icon svg={<Icons.PriceTagsOutline />} />}>
        Tag Version
      </Button>
      <Popover placement="bottom end">
        <PopoverArrow />
        <Dialog>
          <View padding="size-100" width="250px">
            <Button
              icon={<Icon svg={<Icons.PlusOutline />} />}
              size="S"
              width="100%"
            >
              New Tag
            </Button>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
