import React from "react";
import { FocusScope } from "react-aria";
import { Label, TextArea } from "react-aria-components";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Popover,
  PopoverArrow,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { Icon, Icons } from "@phoenix/components/icon";

export const AnnotationInputExplanation = ({
  explanation,
  onSubmit,
}: {
  explanation?: string;
  onSubmit?: (explanation: string) => void;
}) => {
  return (
    <DialogTrigger>
      <TooltipTrigger placement="top">
        <TriggerWrap>
          <Button variant="quiet" type="button">
            <Icon svg={<Icons.Edit2Outline />} />
          </Button>
        </TriggerWrap>
        <Tooltip>Explain this score</Tooltip>
      </TooltipTrigger>
      <Popover placement="bottom end">
        <PopoverArrow />
        <Dialog>
          {({ close }) => (
            <FocusScope autoFocus restoreFocus>
              <View padding="size-100">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    const explanation = formData.get("explanation");
                    if (typeof explanation === "string") {
                      onSubmit?.(explanation);
                    }
                    close();
                  }}
                >
                  <Flex direction="column" gap="size-100">
                    <TextField name="explanation" defaultValue={explanation}>
                      <Label>Explanation</Label>
                      <TextArea rows={2} />
                      <Text slot="description">
                        Why did you give this score?
                      </Text>
                    </TextField>
                    <Button variant="primary" type="submit">
                      Save
                    </Button>
                  </Flex>
                </form>
              </View>
            </FocusScope>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
