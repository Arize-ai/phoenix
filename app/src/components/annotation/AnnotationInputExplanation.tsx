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
import { Annotation } from "@phoenix/components/annotation";
import { Icon, Icons } from "@phoenix/components/icon";

export const AnnotationInputExplanation = ({
  annotation,
  onSubmit,
  containerRef,
}: {
  annotation?: Annotation;
  onSubmit?: (explanation: string) => void;
  containerRef?: HTMLDivElement;
}) => {
  const fieldName = annotation?.name
    ? `${annotation.name}.explanation`
    : "explanation";
  return (
    <DialogTrigger>
      <TooltipTrigger placement="top">
        <TriggerWrap>
          <Button variant="quiet" type="button" isDisabled={!annotation?.id}>
            <Icon svg={<Icons.FileTextOutline />} />
          </Button>
        </TriggerWrap>
        <Tooltip>Explain this score</Tooltip>
      </TooltipTrigger>
      <Popover placement="bottom end" UNSTABLE_portalContainer={containerRef}>
        <PopoverArrow />
        <Dialog>
          {({ close }) => (
            <FocusScope autoFocus restoreFocus>
              <View padding="size-100">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    const explanation = formData.get(fieldName);
                    if (typeof explanation === "string") {
                      onSubmit?.(explanation);
                    }
                    close();
                  }}
                >
                  <Flex direction="column" gap="size-100">
                    <TextField
                      name={fieldName}
                      defaultValue={annotation?.explanation ?? ""}
                    >
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
