import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

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
  Loading,
  Modal,
  ModalOverlay,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlockWithCopy } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import type { DecisionExportDialogQuery } from "./__generated__/DecisionExportDialogQuery.graphql";
import {
  buildDecisionRequest,
  type DecisionWireFormat,
  getDecisionValidationError,
  toProviderBody,
} from "./decisionUtils";
import type { PlaygroundInstanceProps } from "./types";
import { useDerivedPlaygroundVariables } from "./useDerivedPlaygroundVariables";

type ExportMode = "sent" | "template";

const WIRE_FORMAT_DESCRIPTIONS: Record<DecisionWireFormat, string> = {
  SYSTEM_ONE:
    "Body for POST /v1/systemone (TypeSafe System One and compatible hosts).",
  OPENAI_DECISIONS: "Body for POST /v1/decisions (OpenAI Decisions API).",
};

/**
 * Show the exact JSON body this instance sends, so it can be pasted into
 * code. "As sent" applies the current Inputs; "Template" keeps the variable
 * placeholders for use with your own data.
 */
export function DecisionExportDialog({
  playgroundInstanceId: instanceId,
}: PlaygroundInstanceProps) {
  const [mode, setMode] = useState<ExportMode>("sent");

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
                <Suspense
                  fallback={
                    <View padding="size-200">
                      <Loading />
                    </View>
                  }
                >
                  <DecisionExportBody instanceId={instanceId} mode={mode} />
                </Suspense>
              </DialogContent>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

function ExportProblem({ children }: { children: string }) {
  return (
    <View paddingX="size-200" paddingTop="size-100" paddingBottom="size-200">
      <Alert variant="warning" banner>
        {children}
      </Alert>
    </View>
  );
}

/**
 * The body itself. The provider's wire format comes from the server, which
 * knows each decision client's API shape, so this never names a provider.
 */
function DecisionExportBody({
  instanceId,
  mode,
}: {
  instanceId: number;
  mode: ExportMode;
}) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((item) => item.id === instanceId)
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const { variablesMap } = useDerivedPlaygroundVariables();
  const { modelProviders } = useLazyLoadQuery<DecisionExportDialogQuery>(
    graphql`
      query DecisionExportDialogQuery {
        modelProviders {
          key
          decisionWireFormat
        }
      }
    `,
    {},
    { fetchPolicy: "store-or-network" }
  );

  if (!instance) {
    return <ExportProblem>This instance no longer exists.</ExportProblem>;
  }
  const draft = instance.decisionRequest;
  const validationError = draft
    ? getDecisionValidationError(draft)
    : "No request";
  if (!draft || validationError) {
    return (
      <ExportProblem>
        {`Fix the request before exporting: ${validationError}`}
      </ExportProblem>
    );
  }
  const wireFormat =
    modelProviders.find((provider) => provider.key === instance.model.provider)
      ?.decisionWireFormat ?? null;
  if (!wireFormat) {
    return (
      <ExportProblem>
        {`${instance.model.provider} offers no decision API on this server. Pick a decision model from the model menu.`}
      </ExportProblem>
    );
  }
  const request = buildDecisionRequest({
    draft,
    templateFormat,
    variables: mode === "sent" ? variablesMap : undefined,
  });
  const json = JSON.stringify(
    toProviderBody({ request, wireFormat, model: instance.model.modelName }),
    null,
    2
  );
  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        <Text size="S" color="text-700">
          {WIRE_FORMAT_DESCRIPTIONS[wireFormat]}{" "}
          {mode === "sent"
            ? "Variables are filled from the Inputs panel."
            : "Variable placeholders are kept for your own data."}
        </Text>
        <JSONBlockWithCopy value={json} />
      </Flex>
    </View>
  );
}
