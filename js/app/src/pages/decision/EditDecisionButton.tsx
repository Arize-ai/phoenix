import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useFragment, useMutation } from "react-relay";

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
  ViewportModal,
  ViewportModalOverlay,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

import type { EditDecisionButton_data$key } from "./__generated__/EditDecisionButton_data.graphql";
import type { EditDecisionButtonPatchDecisionMutation } from "./__generated__/EditDecisionButtonPatchDecisionMutation.graphql";
type EditDecisionFormParams = {
  description: string;
  metadata: string;
};

export function EditDecisionButton(props: {
  decision: EditDecisionButton_data$key;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const data = useFragment(
    graphql`
      fragment EditDecisionButton_data on Decision {
        id
        description
        metadata
      }
    `,
    props.decision
  );
  const [mutateDecision, isMutating] =
    useMutation<EditDecisionButtonPatchDecisionMutation>(graphql`
      mutation EditDecisionButtonPatchDecisionMutation(
        $input: PatchDecisionInput!
      ) {
        patchDecision(input: $input) {
          ...DecisionIndexPage__main
          ...DecisionLayout__main
        }
      }
    `);
  const { control, handleSubmit, reset } = useForm<EditDecisionFormParams>({
    defaultValues: {
      description: data.description ?? "",
      metadata: data.metadata ? JSON.stringify(data.metadata, null, 2) : "{}",
    },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open) {
        reset({
          description: data.description ?? "",
          metadata: data.metadata
            ? JSON.stringify(data.metadata, null, 2)
            : "{}",
        });
      } else {
        setError(null);
      }
    },
    [data, reset]
  );
  const onSubmit = useCallback(
    (decisionPatch: EditDecisionFormParams) => {
      // Parse metadata, or set to null to clear if empty
      let metadata: unknown = null;
      if (decisionPatch.metadata && decisionPatch.metadata.trim() !== "") {
        try {
          metadata = JSON.parse(decisionPatch.metadata);
        } catch (_error) {
          setError("Failed to parse metadata as JSON");
          return;
        }
      }

      mutateDecision({
        variables: {
          input: {
            decisionId: data.id,
            description: decisionPatch.description,
            metadata,
          },
        },
        onCompleted: () => {
          setIsOpen(false);
          notifySuccess({
            title: "Decision updated",
            message: "The decision has been updated successfully",
          });
        },
        onError: (error) => {
          setError(
            getErrorMessagesFromRelayMutationError(error)?.[0] ??
              "Error updating decision"
          );
        },
      });
    },
    [data.id, mutateDecision, notifySuccess]
  );
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.Settings />} />}
        variant="quiet"
        aria-label="configure decision"
      />
      <ViewportModalOverlay
        isDismissable
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
      >
        <ViewportModal size="M">
          <Dialog>
            <DialogHeader>
              <DialogTitle>Edit Decision Details</DialogTitle>
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
                        <Label>Decision Description</Label>
                        <TextArea placeholder="Enter a description for the decision" />
                        <Text slot="description">
                          A description of the decision
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
                        description="A JSON object containing metadata for the decision"
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
                    isDisabled={isMutating}
                    onPress={() => handleSubmit(onSubmit)()}
                  >
                    {isMutating ? "Saving..." : "Save"}
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
