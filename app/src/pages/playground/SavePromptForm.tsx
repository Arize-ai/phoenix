import { css } from "@emotion/react";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Checkbox,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import {
  DEFAULT_PROMPT_VERSION_TAGS,
  IDENTIFIER_DESCRIPTION,
} from "@phoenix/constants";
import {
  TransformingInputController,
  useTransformingInput,
} from "@phoenix/hooks/useTransformingInput";
import type { SavePromptFormQuery } from "@phoenix/pages/playground/__generated__/SavePromptFormQuery.graphql";
import { PromptComboBox } from "@phoenix/pages/playground/PromptComboBox";
import {
  transformIdentifierInput,
  validateIdentifier,
} from "@phoenix/utils/identifierUtils";
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
  tags?: string[];
};

type SavePromptFormValues = SavePromptFormParams;

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
              versionTags {
                name
              }
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
  const [isPromptInputFocused, setIsPromptInputFocused] = useState(false);

  const mode: "create" | "update" = selectedPrompt ? "update" : "create";
  const submitButtonText =
    mode === "create" ? "Create Prompt" : "Update Prompt";

  // Tags state: tags added via inline "New Tag" form (not yet saved)
  const [newTags, setNewTags] = useState<string[]>([]);

  // Compute available tags: defaults + prompt-specific tags (update mode) + new tags
  const availableTags = useMemo(() => {
    const defaultTagNames = DEFAULT_PROMPT_VERSION_TAGS.map((t) => t.name);
    const promptTagNames =
      selectedPrompt?.prompt?.versionTags?.map((t) => t.name) ?? [];
    return Array.from(
      new Set([...defaultTagNames, ...promptTagNames, ...newTags])
    );
  }, [selectedPrompt, newTags]);

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { isDirty, isSubmitted },
  } = useForm<SavePromptFormValues>({
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
      tags: [],
    },
    mode: "onChange",
    resetOptions: {
      keepDefaultValues: true,
    },
  });

  const onSubmit = useCallback(
    (params: SavePromptFormValues) => {
      const description = params.description?.trim() || undefined;
      const normalizedParams: SavePromptFormParams = {
        ...params,
        description,
      };
      if (mode === "create") {
        onCreate(normalizedParams, onClose);
      } else {
        onUpdate(normalizedParams, onClose);
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
            validate: validateIdentifier,
          }}
          render={({ field: { onBlur, onChange }, fieldState }) => {
            const shouldShowError =
              (fieldState.isTouched && !isPromptInputFocused) || isSubmitted;
            return (
              <TransformingInputController
                value={promptInputValue}
                onValueChange={(value) => {
                  setPromptInputValue(value);
                  onChange(value);
                }}
                transformValue={transformIdentifierInput}
              >
                {(transformingInput) => (
                  <PromptComboBox
                    label="Prompt"
                    description={`Select a prompt, or enter a new name. ${IDENTIFIER_DESCRIPTION}`}
                    placeholder="Select or enter new prompt name"
                    isRequired
                    onFocus={() => setIsPromptInputFocused(true)}
                    onBlur={() => {
                      setIsPromptInputFocused(false);
                      onBlur();
                    }}
                    inputValue={transformingInput.displayValue}
                    onInputChange={transformingInput.handleValueChange}
                    inputProps={transformingInput.inputProps}
                    errorMessage={
                      shouldShowError ? fieldState.error?.message : undefined
                    }
                    allowsCustomValue
                    onChange={(promptId) => {
                      onChange(promptId);
                      setSelectedPromptId(
                        typeof promptId === "string" ? promptId : null
                      );
                    }}
                    promptId={selectedPromptId}
                  />
                )}
              </TransformingInputController>
            );
          }}
        />
      </View>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <View paddingX="size-200" paddingBottom="size-200">
          <Flex direction="column" gap="size-100">
            <Controller
              name="description"
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  onChange={onChange}
                  onBlur={onBlur}
                  value={value ?? ""}
                  size="S"
                >
                  <Label>Description (optional)</Label>
                  <TextArea />
                  <Text slot="description">
                    {mode === "create"
                      ? "A short description of this prompt"
                      : "A short description of the changes in this version"}
                  </Text>
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

        <View paddingX="size-200" paddingBottom="size-200">
          <Flex direction="column" gap="size-50">
            <Label>Tags (optional)</Label>
            <Text
              color="text-700"
              size="XS"
              css={css`
                margin-bottom: var(--global-dimension-size-50);
              `}
            >
              Select tags to apply to the saved version
            </Text>

            <Controller
              name="tags"
              control={control}
              render={({ field: { value, onChange } }) => (
                <ul>
                  {availableTags.map((tagName) => {
                    const isSelected = (value ?? []).includes(tagName);
                    return (
                      <li key={tagName}>
                        <View paddingY="size-50">
                          <Checkbox
                            name={tagName}
                            isSelected={isSelected}
                            onChange={(checked) => {
                              const current = value ?? [];
                              if (checked) {
                                onChange([...current, tagName]);
                              } else {
                                onChange(current.filter((t) => t !== tagName));
                              }
                            }}
                          >
                            {tagName}
                          </Checkbox>
                        </View>
                      </li>
                    );
                  })}
                </ul>
              )}
            />
            <NewTagInlineForm
              existingTags={availableTags}
              onAdd={(tagName) => {
                setNewTags((prev) => [...prev, tagName]);
                // Auto-select the newly created tag
                const currentTags = getValues("tags") ?? [];
                setValue("tags", [...currentTags, tagName], {
                  shouldDirty: true,
                });
              }}
            />
          </Flex>
        </View>

        <View
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderTopColor="default"
          borderTopWidth="thin"
        >
          <Flex direction="row" justifyContent="end">
            <Button
              variant={isDirty ? "primary" : "default"}
              size="S"
              isDisabled={isSubmitting}
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

function NewTagInlineForm({
  existingTags,
  onAdd,
}: {
  existingTags: string[];
  onAdd: (tagName: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [hasStoppedEditing, setHasStoppedEditing] = useState(false);
  const transformingInput = useTransformingInput({
    value: inputValue,
    onValueChange: setInputValue,
    transformValue: transformIdentifierInput,
  });

  const error = useMemo(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return null;
    const validationError = validateIdentifier(trimmed);
    if (typeof validationError === "string") return validationError;
    if (existingTags.includes(trimmed)) return "Tag already exists";
    return null;
  }, [inputValue, existingTags]);

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || error) {
      setHasStoppedEditing(true);
      return;
    }
    onAdd(trimmed);
    setInputValue("");
    setHasStoppedEditing(false);
  }, [inputValue, error, onAdd]);

  const displayedError = hasStoppedEditing ? error : null;

  return (
    <Flex direction="row" gap="size-100" alignItems="start">
      <TextField
        size="S"
        aria-label="New tag name"
        value={transformingInput.displayValue}
        onChange={transformingInput.handleValueChange}
        onFocus={() => setHasStoppedEditing(false)}
        onBlur={() => setHasStoppedEditing(true)}
        isInvalid={!!displayedError}
        css={css`
          flex: 1 1 auto;
        `}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
      >
        <Input {...transformingInput.inputProps} placeholder="New tag name" />
        {displayedError ? (
          <FieldError>{displayedError}</FieldError>
        ) : (
          <Text slot="description">{IDENTIFIER_DESCRIPTION}</Text>
        )}
      </TextField>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.Plus />} />}
        onPress={handleAdd}
        isDisabled={!inputValue.trim()}
      >
        Add
      </Button>
    </Flex>
  );
}
