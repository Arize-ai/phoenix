import { useState } from "react";

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
  Text,
  View,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { parseDecisionImport } from "./decisionUtils";

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

/**
 * Paste a request body from code or a trace and load it into the shared
 * editor. Accepts TypeSafe System One and OpenAI Decisions shapes; the format
 * is detected from the body. The body's `model` is reported but not applied,
 * since each instance owns its model.
 */
export function DecisionImportDialog({ isDisabled }: { isDisabled: boolean }) {
  const setDecisionRequest = usePlaygroundContext(
    (state) => state.setDecisionRequest
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
                      Paste a System One body (<code>state</code> and{" "}
                      <code>questions</code>) or an OpenAI Decisions body (
                      <code>input</code> and <code>questions</code>). The format
                      is detected automatically and replaces the current
                      request. A <code>model</code> field is ignored; pick the
                      model on each instance.
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
                <View
                  padding="size-200"
                  borderTopWidth="thin"
                  borderTopColor="default"
                >
                  <Flex direction="row" justifyContent="end" gap="size-100">
                    <Button size="S" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      size="S"
                      variant="primary"
                      isDisabled={!text.trim()}
                      onPress={() => {
                        setError(null);
                        try {
                          const { draft } = parseDecisionImport(text);
                          setDecisionRequest({
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
                  </Flex>
                </View>
              </DialogContent>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
