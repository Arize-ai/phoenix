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
  EmptyState,
  EmptyStateGraphic,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  SegmentedControl,
  SegmentedControlItem,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { JSONBlockWithCopy } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { getProviderName } from "@phoenix/utils/generativeUtils";

import {
  buildDecisionRequest,
  getDecisionValidationError,
  getDecisionWireFormat,
  toProviderBody,
} from "./decisionUtils";
import { useDerivedPlaygroundVariables } from "./useDerivedPlaygroundVariables";

/**
 * Show the exact JSON body each decision instance sends, so it can be pasted
 * into code. "As sent" applies the current Inputs; "Template" keeps the
 * variable placeholders for use with your own data.
 */
export function DecisionExportDialog() {
  const draft = usePlaygroundContext((state) => state.decisionRequest);
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const instances = usePlaygroundContext((state) =>
    state.instances.filter(
      (instance) => instance.model.modelType === "DECISION"
    )
  );
  const { variablesMap } = useDerivedPlaygroundVariables();
  const [mode, setMode] = useState<"sent" | "template">("sent");

  const validationError = draft
    ? getDecisionValidationError(draft)
    : "No request";

  const bodies = useMemo(() => {
    if (!draft || validationError) return [];
    const request = buildDecisionRequest(draft, {
      templateFormat,
      variables: mode === "sent" ? variablesMap : undefined,
    });
    return instances.map((instance, index) => {
      const format = getDecisionWireFormat(instance.model.provider);
      return {
        id: String(instance.id),
        index,
        label: `${getProviderName(instance.model.provider)} · ${instance.model.modelName ?? "model"}`,
        format,
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
    });
  }, [draft, validationError, templateFormat, mode, variablesMap, instances]);

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
                {validationError ? (
                  <View
                    paddingX="size-200"
                    paddingTop="size-100"
                    paddingBottom="size-200"
                  >
                    <Alert variant="warning" banner>
                      Fix the request before exporting: {validationError}
                    </Alert>
                  </View>
                ) : bodies.length === 0 ? (
                  <View padding="size-200">
                    <EmptyState
                      graphic={<EmptyStateGraphic variant="genericAdd" />}
                      description="Select a decision model on an instance to export its request."
                    />
                  </View>
                ) : (
                  <Tabs defaultSelectedKey={bodies[0].id}>
                    <TabList aria-label="Decision instances">
                      {bodies.map((body) => (
                        <Tab key={body.id} id={body.id}>
                          <Flex
                            direction="row"
                            gap="size-75"
                            alignItems="center"
                          >
                            <AlphabeticIndexIcon index={body.index} />
                            {body.label}
                          </Flex>
                        </Tab>
                      ))}
                    </TabList>
                    {bodies.map((body) => (
                      <TabPanel key={body.id} id={body.id}>
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
                      </TabPanel>
                    ))}
                  </Tabs>
                )}
              </DialogContent>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
