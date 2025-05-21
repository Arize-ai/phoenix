import { useCallback, useRef, useState } from "react";
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
import { SavePromptFormQuery } from "@phoenix/pages/playground/__generated__/SavePromptFormQuery.graphql";
import { PromptComboBox } from "@phoenix/pages/playground/PromptComboBox";
import { identifierPattern } from "@phoenix/utils/identifierUtils";

export type SavePromptSubmitHandler = (params: SavePromptFormParams) => void;

export type SavePromptFormParams = {
  promptId?: string;
  name: string;
  description?: string;
};

export function SavePromptForm({
  onCreate,
  onUpdate,
  isSubmitting = false,
  defaultSelectedPromptId,
}: {
  onCreate: SavePromptSubmitHandler;
  onUpdate: SavePromptSubmitHandler;
  isSubmitting?: boolean;
  defaultSelectedPromptId?: string;
}) {
  const flexContainer = useRef<HTMLDivElement>(null);
  const prompts = useLazyLoadQuery<SavePromptFormQuery>(
    graphql`
      query SavePromptFormQuery {
        prompts {
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
    trigger,
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
    },
    reValidateMode: "onChange",
    resetOptions: {
      keepDefaultValues: true,
    },
  });

  const onSubmit = useCallback(
    (params: SavePromptFormParams) => {
      if (mode === "create") {
        onCreate(params);
      } else {
        onUpdate(params);
      }
    },
    [onCreate, onUpdate, mode]
  );

  return (
    <Flex direction="column" gap="size-100" ref={flexContainer}>
      <View paddingX="size-200" paddingTop="size-200">
        <Controller
          name="name"
          control={control}
          rules={{
            required: {
              message: "Prompt is required",
              value: true,
            },
            pattern: identifierPattern,
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
                trigger("name");
              }}
              // this seems... not great. not sure how else to get a stable element reference that doesn't use a ref
              // https://react-spectrum.adobe.com/react-aria/Popover.html#props
              // eslint-disable-next-line react-compiler/react-compiler
              container={flexContainer.current ?? undefined}
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
