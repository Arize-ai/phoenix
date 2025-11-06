import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { SavePromptFormQuery } from "@phoenix/pages/playground/__generated__/SavePromptFormQuery.graphql";
import { PromptComboBox } from "@phoenix/pages/playground/PromptComboBox";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

export type SavePromptSubmitHandler = (
  params: SavePromptFormParams,
  close: () => void
) => void;

export type SavePromptFormParams = {
  promptId?: string;
  name: string;
  description?: string;
  metadata?: string;
};

export function SavePromptForm({
  onCreate,
  onUpdate,
  isSubmitting = false,
  defaultSelectedPromptId,
  onClose,
}: {
  onCreate: SavePromptSubmitHandler;
  onUpdate: SavePromptSubmitHandler;
  isSubmitting?: boolean;
  defaultSelectedPromptId?: string;
  onClose: () => void;
}) {
  const prompts = useLazyLoadQuery<SavePromptFormQuery>(
    graphql`
      query SavePromptFormQuery {
        prompts(first: 200) {
          edges {
            prompt: node {
              id
              name
            }
          }
        }
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(
    defaultSelectedPromptId ?? null
  );
  const selectedPrompt = prompts?.prompts?.edges?.find(
    (edge) => edge?.prompt?.id === selectedPromptId
  );
  const [promptInputValue, setPromptInputValue] = useState<string>(
    selectedPrompt?.prompt?.name ?? ""
  );

  const mode: "create" | "update" = selectedPrompt ? "update" : "create";
  const submitButtonText =
    mode === "create" ? "Create Prompt" : "Update Prompt";
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm<SavePromptFormParams>({
    values: {
      promptId: selectedPromptId ?? undefined,
      name:
        mode === "update" && selectedPrompt
          ? selectedPrompt?.prompt?.name
          : promptInputValue,
    },
    defaultValues: {
      description: "",
      metadata: "{}",
    },
    mode: "onChange",
    resetOptions: {
      keepDefaultValues: true,
    },
  });

  const onSubmit = useCallback(
    (params: SavePromptFormParams) => {
      if (mode === "create") {
        onCreate(params, onClose);
      } else {
        onUpdate(params, onClose);
      }
    },
    [onCreate, onUpdate, mode, onClose]
  );

  return (
    <Flex direction="column" gap="size-100">
      <View paddingX="size-200" paddingTop="size-200">
        <Controller
          name="name"
          control={control}
          rules={{
            required: { value: true, message: "Prompt name is required" },
            validate: validateIdentifier,
          }}
          render={({ field: { onBlur, onChange }, fieldState }) => (
            <PromptComboBox
              label="Prompt"
              description="The prompt to update, or prompt name to create"
              placeholder="Select or enter new prompt name"
              isRequired
              onBlur={onBlur}
              defaultInputValue={promptInputValue}
              onInputChange={(value) => {
                setPromptInputValue(value);
                onChange(value);
              }}
              errorMessage={fieldState.error?.message}
              allowsCustomValue
              onChange={(promptId) => {
                onChange(promptId);
                setSelectedPromptId(promptId);
              }}
              promptId={selectedPromptId}
            />
          )}
        />
      </View>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <View paddingX="size-200" paddingBottom="size-200">
          <Flex direction="column" gap="size-100">
            <Controller
              name="description"
              control={control}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TextField
                  isInvalid={invalid}
                  onChange={onChange}
                  onBlur={onBlur}
                  value={value}
                  size="S"
                >
                  <Label>
                    {mode === "create"
                      ? "Prompt Description"
                      : "Change Description"}
                  </Label>
                  <TextArea />
                  {error ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      {mode === "create"
                        ? "A description of your prompt (optional)"
                        : "A description of your changes to the prompt (optional)"}
                    </Text>
                  )}
                </TextField>
              )}
            />
            {mode === "create" && (
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
                    description="A JSON object containing metadata for the prompt (optional)"
                  >
                    <JSONEditor
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  </CodeEditorFieldWrapper>
                )}
              />
            )}
          </Flex>
        </View>

        <View
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderTopColor="light"
          borderTopWidth="thin"
        >
          <Flex direction="row" justifyContent="end">
            <Button
              variant={isDirty ? "primary" : "default"}
              size="S"
              isDisabled={isSubmitting || !isValid}
              type="submit"
            >
              {submitButtonText}
            </Button>
          </Flex>
        </View>
      </Form>
    </Flex>
  );
}
