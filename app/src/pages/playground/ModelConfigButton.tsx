import { memo, Suspense, useState } from "react";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import {
  ModelConfigFormFields,
  SaveModelConfigButton,
} from "@phoenix/components/playground/model";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { areRequiredInvocationParametersConfigured } from "./playgroundUtils";
import { PlaygroundInstanceProps } from "./types";

/**
 * This is the maximum width of the model config button model name text.
 * This is used to ensure that the model name text does not overflow the model config button.
 */
const MODEL_CONFIG_NAME_BUTTON_MAX_WIDTH = 150;

type ModelConfigButtonProps = Pick<
  PlaygroundInstanceProps,
  "playgroundInstanceId"
>;

/**
 * This is a legacy component that is used to configure the model for a playground instance.
 * It is deprecated and will be removed in a future version.
 * @deprecated Use the PlaygroundModelMenu component instead.
 */
function ModelConfigButton(props: ModelConfigButtonProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find(
      (instance) => instance.id === props.playgroundInstanceId
    )
  );

  if (!instance) {
    throw new Error(
      `Playground instance ${props.playgroundInstanceId} not found`
    );
  }

  const modelSupportedInvocationParameters =
    instance.model.supportedInvocationParameters;
  const configuredInvocationParameters = instance.model.invocationParameters;
  const requiredInvocationParametersConfigured =
    areRequiredInvocationParametersConfigured(
      configuredInvocationParameters,
      modelSupportedInvocationParameters
    );

  return (
    <DialogTrigger>
      <Button
        size="S"
        leadingVisual={
          <GenerativeProviderIcon
            provider={instance.model.provider}
            height={16}
          />
        }
      >
        <Flex direction="row" gap="size-100" alignItems="center" height="100%">
          <Truncate maxWidth={MODEL_CONFIG_NAME_BUTTON_MAX_WIDTH}>
            <Text>{instance.model.modelName || "--"}</Text>
          </Truncate>
          {!requiredInvocationParametersConfigured ? (
            <TooltipTrigger delay={0}>
              <span>
                <Icon color="danger" svg={<Icons.InfoOutline />} />
              </span>
              <Tooltip>
                Some required invocation parameters are not configured.
              </Tooltip>
            </TooltipTrigger>
          ) : null}
        </Flex>
      </Button>
      <ModalOverlay>
        <Modal variant="slideover" size="S">
          <ModelConfigDialog {...props} />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

type ModelConfigDialogProps = ModelConfigButtonProps;
function ModelConfigDialog(props: ModelConfigDialogProps) {
  const [hasCustomHeadersError, setHasCustomHeadersError] = useState(false);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Model Configuration</DialogTitle>
          <DialogTitleExtra>
            <SaveModelConfigButton
              playgroundInstanceId={props.playgroundInstanceId}
              isDisabled={hasCustomHeadersError}
            />
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        <Suspense>
          <ModelConfigFormFields
            playgroundInstanceId={props.playgroundInstanceId}
            onCustomHeadersErrorChange={setHasCustomHeadersError}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

const MemoizedModelConfigButton = memo(ModelConfigButton);

export { MemoizedModelConfigButton as ModelConfigButton };
