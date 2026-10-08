import { useMemo, useState } from "react";

import {
  Alert,
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
  SegmentedControl,
  SegmentedControlItem,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlockWithCopy } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import {
  buildDecisionRequest,
  getDecisionValidationError,
  getDecisionWireFormat,
  toProviderBody,
} from "./decisionUtils";
import type { PlaygroundInstanceProps } from "./types";
import { useDerivedPlaygroundVariables } from "./useDerivedPlaygroundVariables";

/**
 * Show the exact JSON body this instance sends, so it can be pasted into
 * code. "As sent" applies the current Inputs; "Template" keeps the variable
 * placeholders for use with your own data.
 */
export function DecisionExportDialog({
  playgroundInstanceId: instanceId,
}: PlaygroundInstanceProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((item) => item.id === instanceId)
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const { variablesMap } = useDerivedPlaygroundVariables();
  const [mode, setMode] = useState<"sent" | "template">("sent");

  const draft = instance?.decisionRequest ?? null;
  const validationError = draft
    ? getDecisionValidationError(draft)
    : "No request";

  const body = useMemo(() => {
    if (!instance || !draft || validationError) return null;
    const request = buildDecisionRequest(draft, {
      templateFormat,
      variables: mode === "sent" ? variablesMap : undefined,
    });
    return {
      format: getDecisionWireFormat(instance.model.provider),
      json: JSON.stringify(
        toProviderBody(
          request,
          instance.model.provider,
          instance.model.modelName
        ),
        null,
        2
      ),
    };
  }, [instance, draft, validationError, templateFormat, mode, variablesMap]);

  return (
    <DialogTrigger>
      <Button size="S" leadingVisual={<Icon svg={<Icons.Code />} />}>
        Export
      </Button>
      <ModalOverlay>
        <Modal size="L">
          <Dialog>
            {({ close }) => (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export decision request</DialogTitle>
                  <DialogTitleExtra>
                    <SegmentedControl
                      size="S"
                      aria-label="Export mode"
                      selectedKey={mode}
                      onSelectionChange={(key) =>
                        setMode(key === "template" ? "template" : "sent")
                      }
                    >
                      <SegmentedControlItem id="sent" aria-label="As sent">
                        As sent
                      </SegmentedControlItem>
                      <SegmentedControlItem id="template" aria-label="Template">
                        Template
                      </SegmentedControlItem>
                    </SegmentedControl>
                    <DialogCloseButton close={close} />
                  </DialogTitleExtra>
                </DialogHeader>
                {validationError || !body ? (
                  <View
                    paddingX="size-200"
                    paddingTop="size-100"
                    paddingBottom="size-200"
                  >
                    <Alert variant="warning" banner>
                      Fix the request before exporting: {validationError}
                    </Alert>
                  </View>
                ) : (
                  <View padding="size-200">
                    <Flex direction="column" gap="size-100">
                      <Text size="S" color="text-700">
                        {body.format === "openai"
                          ? "Body for POST /v1/decisions (OpenAI Decisions API)."
                          : "Body for POST /v1/systemone (TypeSafe System One and compatible hosts)."}{" "}
                        {mode === "sent"
                          ? "Variables are filled from the Inputs panel."
                          : "Variable placeholders are kept for your own data."}
                      </Text>
                      <JSONBlockWithCopy value={body.json} />
                    </Flex>
                  </View>
                )}
              </DialogContent>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
