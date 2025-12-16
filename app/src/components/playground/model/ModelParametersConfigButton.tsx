import { Suspense } from "react";

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

import { ModelInvocationParametersFormFields } from "./ModelInvocationParametersFormFields";

export type ModelParametersConfigButtonProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
};

export function ModelParametersConfigButton(
  props: ModelParametersConfigButtonProps
) {
  const { playgroundInstanceId } = props;

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
        <Dialog>
          <View padding="size-200" overflow="auto" width="400px">
            <Suspense>
              <ModelInvocationParametersFormFields
                playgroundInstanceId={playgroundInstanceId}
              />
            </Suspense>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
