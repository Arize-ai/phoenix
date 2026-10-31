import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Form,
  Icon,
  Icons,
  Label,
  Text,
  TextArea,
  TextField,
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

type EditDetailsFormParams = {
  description: string;
  metadata: string;
};

/**
 * The gear button beside a prompt's or decision's description and metadata,
 * and the dialog that edits them. The caller runs the mutation: `onSubmit`
 * receives the parsed metadata, or null when it was cleared, and resolves to
 * an error message or null, which closes the dialog.
 */
export function EditDetailsButton({
  entityLabel,
  description,
  metadata,
  onSubmit,
  isSubmitting,
}: {
  /** "Prompt" or "Decision", as the dialog and fields name it. */
  entityLabel: string;
  description: string | null | undefined;
  metadata: unknown;
  onSubmit: (patch: {
    description: string;
    metadata: unknown;
  }) => Promise<string | null>;
  isSubmitting: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toDefaults = () => ({
    description: description ?? "",
    metadata: metadata ? JSON.stringify(metadata, null, 2) : "{}",
  });
  const { control, handleSubmit, reset } = useForm<EditDetailsFormParams>({
    defaultValues: toDefaults(),
  });
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      reset(toDefaults());
    } else {
      setError(null);
    }
  };
  const submit = async (patch: EditDetailsFormParams) => {
    // Parse metadata, or set to null to clear if empty
    let parsedMetadata: unknown = null;
    if (patch.metadata && patch.metadata.trim() !== "") {
      try {
        parsedMetadata = JSON.parse(patch.metadata);
      } catch (_error) {
        setError("Failed to parse metadata as JSON");
        return;
      }
    }
    const submitError = await onSubmit({
      description: patch.description,
      metadata: parsedMetadata,
    });
    if (submitError) {
      setError(submitError);
    } else {
      setIsOpen(false);
    }
  };
  const lowerLabel = entityLabel.toLowerCase();
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.Settings />} />}
        variant="quiet"
        aria-label={`configure ${lowerLabel}`}
      />
      <ViewportModalOverlay
        isDismissable
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
      >
        <ViewportModal size="M">
          <Dialog>
            <DialogHeader>
              <DialogTitle>Edit {entityLabel} Details</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <Form>
              {error && (
                <View paddingX="size-200" paddingTop="size-100">
                  <Alert variant="danger">{error}</Alert>
                </View>
              )}
              <View padding="size-200">
                <Flex direction="column" gap="size-100">
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <TextField value={field.value} onChange={field.onChange}>
                        <Label>{entityLabel} Description</Label>
                        <TextArea
                          placeholder={`Enter a description for the ${lowerLabel}`}
                        />
                        <Text slot="description">
                          A description of the {lowerLabel}
                        </Text>
                      </TextField>
                    )}
                  />
                  <Controller
                    name="metadata"
                    control={control}
                    rules={{
                      validate: (value) => {
                        // Allow empty values (will be treated as null)
                        if (!value || value.trim() === "") {
                          return true;
                        }
                        if (!isJSONObjectString(value)) {
                          return "metadata must be a valid JSON object";
                        }
                        return true;
                      },
                    }}
                    render={({
                      field: { onChange, onBlur, value },
                      fieldState: { error },
                    }) => (
                      <CodeEditorFieldWrapper
                        label={"Metadata"}
                        errorMessage={error?.message}
                        description={`A JSON object containing metadata for the ${lowerLabel}`}
                      >
                        <JSONEditor
                          value={value}
                          onChange={onChange}
                          onBlur={onBlur}
                        />
                      </CodeEditorFieldWrapper>
                    )}
                  />
                </Flex>
              </View>
              <View
                paddingX="size-200"
                paddingY="size-100"
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex direction="row" gap="size-100" justifyContent="end">
                  <Button slot="close" size="S">
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="S"
                    isDisabled={isSubmitting}
                    onPress={() => handleSubmit(submit)()}
                  >
                    {isSubmitting ? "Saving..." : "Save"}
                  </Button>
                </Flex>
              </View>
            </Form>
          </Dialog>
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
