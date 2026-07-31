import { useCallback, useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  Popover,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { MediaKind } from "@phoenix/schemas/promptSchemas";
import { selectPlaygroundInstanceMessage } from "@phoenix/store/playground/selectors";
import {
  makeFileVariablePart,
  makeImageVariablePart,
} from "@phoenix/utils/promptUtils";

import { useDerivedPlaygroundVariables } from "./useDerivedPlaygroundVariables";

const KIND_COPY = {
  image: {
    buttonLabel: "Add image input",
    title: "Add image input",
    description:
      "Name the image, then supply it under Inputs by uploading a file or pasting an image URL. One prompt can run against many images this way.",
    placeholder: "question_image",
    invalidName: "That is not a valid input name.",
    missingName: "Enter a name for the image.",
  },
  file: {
    buttonLabel: "Add PDF input",
    title: "Add PDF input",
    description:
      "Name the document, then supply it under Inputs by uploading a PDF or pasting a PDF URL. One prompt can run against many documents this way.",
    placeholder: "contract_pdf",
    invalidName: "That is not a valid input name.",
    missingName: "Enter a name for the document.",
  },
} as const satisfies Record<MediaKind, unknown>;

/**
 * Declares a media input on one message.
 *
 * A media variable is positional — it reserves a place in this message — while its
 * value is supplied on the Inputs panel, so one prompt can run against many files.
 * Living on the message's own toolbar is what makes the position unambiguous.
 */
export function AddMediaInputButton({
  instanceId,
  messageId,
  kind,
}: {
  instanceId: number;
  messageId: number;
  kind: MediaKind;
}) {
  const updateMessage = usePlaygroundContext((state) => state.updateMessage);
  const message = usePlaygroundContext(
    selectPlaygroundInstanceMessage(messageId)
  );
  const { variableKeys } = useDerivedPlaygroundVariables();
  const copy = KIND_COPY[kind];

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addMediaInput = useCallback(
    (close: () => void) => {
      const trimmed = name.trim();
      if (!trimmed) {
        setError(copy.missingName);
        return;
      }
      if (variableKeys.includes(trimmed)) {
        setError(`This prompt already has an input named ${trimmed}.`);
        return;
      }
      if (kind === "image") {
        const part = makeImageVariablePart(trimmed);
        if (!part) {
          setError(copy.invalidName);
          return;
        }
        updateMessage({
          instanceId,
          messageId,
          patch: {
            imageVariables: [...(message?.imageVariables ?? []), part],
          },
        });
      } else {
        const part = makeFileVariablePart(trimmed);
        if (!part) {
          setError(copy.invalidName);
          return;
        }
        updateMessage({
          instanceId,
          messageId,
          patch: {
            fileVariables: [...(message?.fileVariables ?? []), part],
          },
        });
      }
      setName("");
      setError(null);
      close();
    },
    [
      name,
      variableKeys,
      message,
      updateMessage,
      instanceId,
      messageId,
      kind,
      copy,
    ]
  );

  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (!open) {
          setName("");
          setError(null);
        }
      }}
    >
      <Button
        aria-label={copy.buttonLabel}
        size="S"
        leadingVisual={
          <Icon svg={kind === "image" ? <Icons.Image /> : <Icons.FileText />} />
        }
      />
      <Popover placement="bottom end">
        <Dialog>
          {({ close }) => (
            <View padding="size-200" width={320}>
              <Flex direction="column" gap="size-100">
                <Text weight="heavy" size="S">
                  {copy.title}
                </Text>
                <Text size="XS" color="text-700">
                  {copy.description}
                </Text>
                {error ? <Alert variant="danger">{error}</Alert> : null}
                <TextField
                  value={name}
                  onChange={setName}
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addMediaInput(close);
                    }
                  }}
                >
                  <Label>Input name</Label>
                  <Input placeholder={copy.placeholder} />
                </TextField>
                <Flex direction="row" gap="size-100" justifyContent="end">
                  <Button size="S" onPress={close}>
                    Cancel
                  </Button>
                  <Button
                    size="S"
                    variant="primary"
                    onPress={() => addMediaInput(close)}
                  >
                    Add
                  </Button>
                </Flex>
              </Flex>
            </View>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
