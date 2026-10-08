import { useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
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
  View,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { parseDecisionImport } from "./decisionUtils";
import type { PlaygroundInstanceProps } from "./types";

const PLACEHOLDER = `{
  "model": "jev-latest",
  "state": "I was charged twice for my order.",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": { "billing": "Payments and refunds", "technical": "Product problems" }
    }
  }
}`;

function Mono({ children }: { children: string }) {
  return (
    <Text size="S" fontFamily="mono">
      {children}
    </Text>
  );
}

/**
 * Paste a request body from code or a trace and load it into this
 * instance. Accepts TypeSafe System One and OpenAI Decisions shapes; the format
 * is detected from the body. The body's `model` is reported but not applied,
 * since each instance owns its model.
 */
export function DecisionImportDialog({
  playgroundInstanceId: instanceId,
}: PlaygroundInstanceProps) {
  const updateDecisionRequest = usePlaygroundContext(
    (state) => state.updateDecisionRequest
  );
  const isDisabled = usePlaygroundContext(
    (state) =>
      state.instances.find((item) => item.id === instanceId)?.activeRunId !=
      null
  );
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <DialogTrigger
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setText("");
          setError(null);
        }
      }}
    >
      <Button
        size="S"
        isDisabled={isDisabled}
        leadingVisual={<Icon svg={<Icons.Download />} />}
      >
        Import
      </Button>
      <ModalOverlay>
        <Modal size="M">
          <Dialog>
            {({ close }) => (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import decision request</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton close={close} />
                  </DialogTitleExtra>
                </DialogHeader>
                {error ? (
                  <View paddingX="size-200" paddingTop="size-100">
                    <Alert variant="danger" banner>
                      {error}
                    </Alert>
                  </View>
                ) : null}
                <View padding="size-200">
                  <Flex direction="column" gap="size-100">
                    <Text size="S" color="text-700">
                      Paste a System One body (<Mono>state</Mono> and{" "}
                      <Mono>questions</Mono>) or an OpenAI Decisions body (
                      <Mono>input</Mono> and <Mono>questions</Mono>). The format
                      is detected automatically and replaces the current
                      request. A <Mono>model</Mono> field is ignored; pick the
                      model from the instance&rsquo;s model menu.
                    </Text>
                    <View
                      borderWidth="thin"
                      borderColor="default"
                      borderRadius="small"
                      overflow="hidden"
                    >
                      <JSONEditor
                        aria-label="Decision request JSON"
                        value={text}
                        onChange={(value) => {
                          setText(value);
                          if (error) setError(null);
                        }}
                        placeholder={PLACEHOLDER}
                        height="320px"
                      />
                    </View>
                  </Flex>
                </View>
                <DialogFooter>
                  <Button variant="default" slot="close">
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={!text.trim()}
                    onPress={() => {
                      setError(null);
                      try {
                        const { draft } = parseDecisionImport(text);
                        updateDecisionRequest(instanceId, {
                          ...draft,
                          revision: Date.now(),
                        });
                        close();
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Could not import the request"
                        );
                      }
                    }}
                  >
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
