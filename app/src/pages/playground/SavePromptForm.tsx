import React, { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Form, TextArea } from "@arizeai/components";

import { Button, Flex, View } from "@phoenix/components";
import { SavePromptFormQuery } from "@phoenix/pages/playground/__generated__/SavePromptFormQuery.graphql";
import { PromptComboBox } from "@phoenix/pages/playground/PromptComboBox";

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
  currentPromptId,
}: {
  onCreate: SavePromptSubmitHandler;
  onUpdate: SavePromptSubmitHandler;
  isSubmitting?: boolean;
  currentPromptId?: string;
}) {
  const flexContainer = useRef<HTMLDivElement>(null);
  const prompts = useLazyLoadQuery<SavePromptFormQuery>(
    graphql`
      query SavePromptFormQuery {
        prompts {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `,
    {}
  );
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(
    currentPromptId ?? null
  );
  const selectedPrompt = prompts?.prompts?.edges?.find(
    (edge) => edge?.node?.id === selectedPromptId
  );
  const [promptInputValue, setPromptInputValue] = useState<string>(
    selectedPrompt?.node?.name ?? ""
  );

  const mode: "create" | "update" =
    selectedPromptId && selectedPrompt ? "update" : "create";
  const submitButtonText =
    mode === "create" ? "Create Prompt" : "Update Prompt";
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid, errors },
  } = useForm<SavePromptFormParams>({
    values: {
      name:
        mode === "update" && selectedPrompt
          ? selectedPrompt?.node?.name
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
    <Flex direction="column" gap="size-200" ref={flexContainer}>
      <View padding="size-200" paddingBottom={0}>
        <Controller
          name="name"
          control={control}
          rules={{
            required: {
              message: "Prompt is required",
              value: true,
            },
          }}
          render={({ field: { onBlur, onChange } }) => (
            <PromptComboBox
              label="Prompt"
              description="The prompt to update, or prompt name to create"
              placeholder="Select a prompt, or enter a new prompt name"
              isRequired
              onBlur={onBlur}
              defaultInputValue={promptInputValue}
              onInputChange={setPromptInputValue}
              // this seems... not great. not sure how else to get a stable element reference that doesn't use a ref
              // https://react-spectrum.adobe.com/react-aria/Popover.html#props
              // eslint-disable-next-line react-compiler/react-compiler
              container={flexContainer.current ?? undefined}
              errorMessage={errors.name?.message}
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
        <View padding="size-200" paddingTop={0}>
          <Controller
            name="description"
            control={control}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextArea
                label="Description"
                description={
                  mode === "create"
                    ? "A description of your prompt (optional)"
                    : "A description of your changes to the prompt (optional)"
                }
                isRequired={false}
                height={100}
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                value={value}
              />
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
            >
              {submitButtonText}
            </Button>
          </Flex>
        </View>
      </Form>
    </Flex>
  );
}
