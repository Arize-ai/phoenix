import { Suspense } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import {
  Button,
  Dialog,
  FieldError,
  Flex,
  Input,
  Label,
  Loading,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import type { CloneDecisionDialogMutation } from "@phoenix/pages/decisions/__generated__/CloneDecisionDialogMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

export const CloneDecisionDialog = ({
  decisionId,
  decisionName,
  decisionDescription,
  decisionMetadata,
}: {
  decisionId: string;
  decisionName: string;
  decisionDescription?: string;
  decisionMetadata?: Record<string, unknown>;
}) => {
  const notifySuccess = useNotifySuccess();
  const navigate = useNavigate();
  const [cloneDecision, isClonePending] =
    useMutation<CloneDecisionDialogMutation>(
      graphql`
        mutation CloneDecisionDialogMutation($input: CloneDecisionInput!) {
          cloneDecision(input: $input) {
            id
          }
        }
      `
    );
  const form = useForm({
    disabled: isClonePending,
    mode: "onChange",
    defaultValues: {
      name: `${decisionName}-clone`,
      description: decisionDescription,
      metadata: decisionMetadata
        ? JSON.stringify(decisionMetadata, null, 2)
        : "{}",
    },
  });
  const {
    control,
    handleSubmit,
    formState: { isValid, errors },
    setError,
  } = form;
  const onSubmit = (close: () => void) =>
    handleSubmit((data) => {
      // Parse metadata, or set to null to clear if empty
      let metadata: unknown = null;
      if (data.metadata && data.metadata.trim() !== "") {
        try {
          metadata = JSON.parse(data.metadata);
        } catch (_error) {
          setError("metadata", {
            message: "Failed to parse metadata as JSON",
          });
          return;
        }
      }
      cloneDecision({
        variables: {
          input: {
            decisionId,
            name: data.name,
            description: data.description,
            metadata,
          },
        },
        onCompleted: (data, errors) => {
          if (errors?.length) {
            setError("root", {
              message: errors.map((error) => error.message).join("\n"),
            });
            return;
          }
          notifySuccess({
            title: "Decision cloned successfully",
            action: {
              text: "View Decision",
              onClick: () => {
                navigate(`/decisions/${data.cloneDecision.id}`);
              },
            },
          });
          close();
        },
        onError: (error) => {
          const message = getErrorMessagesFromRelayMutationError(error);
          if (message?.[0]?.includes("already exists")) {
            setError("name", {
              message: message?.[0],
            });
          } else {
            setError("root", {
              message: message?.[0],
            });
          }
        },
      });
    });
  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Decision</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton slot="close" />
            </DialogTitleExtra>
          </DialogHeader>
          <Suspense fallback={<Loading />}>
            <View padding="size-200">
              <form onSubmit={onSubmit(close)}>
                <Flex direction="column" gap="size-100">
                  <Controller
                    control={control}
                    name="name"
                    rules={{
                      validate: {
                        differsFromOriginalName: (value) => {
                          if (value.trim() === decisionName.trim()) {
                            return "Name must be different from the original decision name";
                          }
                          return true;
                        },
                        isValidIdentifier: validateIdentifier,
                      },
                    }}
                    render={({
                      field: { onChange, onBlur, value, disabled },
                      fieldState: { error },
                    }) => (
                      <TextField isInvalid={!!error?.message}>
                        <Label>Name</Label>
                        <Input
                          name="name"
                          type="text"
                          onChange={onChange}
                          onBlur={onBlur}
                          value={value}
                          disabled={disabled}
                        />
                        {!error && (
                          <Text slot="description">
                            A name for the cloned decision.
                          </Text>
                        )}
                        <FieldError>{error?.message}</FieldError>
                      </TextField>
                    )}
                  />
                  <Controller
                    control={control}
                    name="description"
                    render={({
                      field: { onChange, onBlur, value, disabled },
                      fieldState: { error },
                    }) => (
                      <TextField
                        isInvalid={!!error?.message}
                        isDisabled={disabled}
                        value={value}
                        onChange={onChange}
                        onBlur={onBlur}
                      >
                        <Label>Description</Label>
                        <TextArea name="description" />
                        {!error && (
                          <Text slot="description">
                            A description for the cloned decision.
                          </Text>
                        )}
                        <FieldError>{error?.message}</FieldError>
                      </TextField>
                    )}
                  />
                  <Controller
                    control={control}
                    name="metadata"
                    rules={{
                      validate: (value) => {
                        // Allow empty values (will be treated as undefined)
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
                        label="Metadata"
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
                {errors?.root && (
                  <Text color="danger">{errors?.root?.message}</Text>
                )}
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button
                    slot="close"
                    variant="default"
                    isDisabled={isClonePending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isDisabled={!isValid}
                    isPending={isClonePending}
                  >
                    Clone
                  </Button>
                </Flex>
              </form>
            </View>
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
};
