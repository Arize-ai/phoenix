import { css } from "@emotion/react";
import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  Dialog,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  NumberField,
  Radio,
  RadioGroup,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import {
  AnnotationConfigDraftProvider,
  useAnnotationConfigDraftStore,
  useAnnotationConfigDraftStoreInstance,
} from "@phoenix/contexts/AnnotationConfigDraftContext";
import type {
  AnnotationConfig,
  AnnotationConfigOptimizationDirection,
  AnnotationConfigType,
} from "@phoenix/pages/settings/types";
import {
  initialDraftPropsFromConfig,
  toAnnotationConfig,
  validateAnnotationConfigDraft,
} from "@phoenix/store/annotationConfigDraftStore";

import { useAnnotationConfigDraftRegistration } from "./useAnnotationConfigDraftRegistration";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const optimizationDirections = [
  "MAXIMIZE",
  "MINIMIZE",
  "NONE",
] satisfies AnnotationConfigOptimizationDirection[];

const types = [
  "CATEGORICAL",
  "CONTINUOUS",
  "FREEFORM",
] satisfies AnnotationConfigType[];

/** Coerce a store number|null into the number|undefined React Aria wants. */
const toNumberFieldValue = (value: number | null): number | undefined =>
  typeof value === "number" && !Number.isNaN(value) ? value : undefined;

type OnAddAnnotationConfig = (
  config: AnnotationConfig,
  args?: { onCompleted?: () => void; onError?: (error: string) => void }
) => void;

export const AnnotationConfigDialog = ({
  onAddAnnotationConfig,
  initialAnnotationConfig,
}: {
  onAddAnnotationConfig: OnAddAnnotationConfig;
  initialAnnotationConfig?: Partial<AnnotationConfig>;
}) => {
  const initialProps = initialDraftPropsFromConfig(initialAnnotationConfig);
  return (
    // Key on the target config so the store re-seeds if this stays mounted
    // while the edit target changes ("new" key for the create flow).
    <AnnotationConfigDraftProvider
      key={initialAnnotationConfig?.id ?? "new"}
      {...initialProps}
    >
      <AnnotationConfigDialogForm onAddAnnotationConfig={onAddAnnotationConfig} />
    </AnnotationConfigDraftProvider>
  );
};

const AnnotationConfigDialogForm = ({
  onAddAnnotationConfig,
}: {
  onAddAnnotationConfig: OnAddAnnotationConfig;
}) => {
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [autoFocusedCategoryIndex, setAutoFocusedCategoryIndex] = useState<
    number | null
  >(null);
  const notifySuccess = useNotifySuccess();

  // Register the agent read/edit draft client actions for the form's lifetime.
  useAnnotationConfigDraftRegistration();

  const store = useAnnotationConfigDraftStoreInstance();
  const mode = useAnnotationConfigDraftStore((s) => s.mode);
  const draft = useAnnotationConfigDraftStore((s) => s.draft);
  const { annotationType } = draft;
  const errors = validateAnnotationConfigDraft(draft);
  const errorFor = (key: string) => (showErrors ? errors[key] : undefined);

  const onSubmit = (close: () => void) => {
    const { draft: current, configId } = store.getState();
    if (Object.keys(validateAnnotationConfigDraft(current)).length > 0) {
      setShowErrors(true);
      return;
    }
    const config = toAnnotationConfig(current, configId ?? "");
    onAddAnnotationConfig(config, {
      onCompleted: () => {
        notifySuccess({
          title:
            mode === "create"
              ? "Annotation config created!"
              : "Annotation config updated!",
        });
        close();
      },
      onError: (err) => setError(err),
    });
  };

  return (
    <Dialog
      css={css`
        border: none;
        width: 700px;
        max-width: 90%;
      `}
    >
      {({ close }) => (
        <Card
          title={
            mode === "create" ? "New Annotation Config" : "Edit Annotation Config"
          }
        >
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(close);
            }}
          >
            {error && (
              <View paddingX="size-200" paddingTop="size-200">
                <Alert variant="danger">{error}</Alert>
              </View>
            )}
            <View minWidth="200px" padding="size-200">
              <Flex
                direction="column"
                gap="size-200"
                className="new-annotation-dialog-container"
              >
                <TextField
                  value={draft.name}
                  onChange={(value) => store.getState().setName(value)}
                  isInvalid={!!errorFor("name")}
                  autoFocus
                >
                  <Label>Annotation Name</Label>
                  <Input placeholder="e.g. correctness" />
                  <FieldError>{errorFor("name")}</FieldError>
                </TextField>
                <TextField
                  value={draft.description ?? ""}
                  onChange={(value) =>
                    store.getState().setDescription(value || null)
                  }
                  css={css`
                    & .react-aria-TextArea {
                      resize: vertical;
                      transition: none;
                    }
                  `}
                >
                  <Label>Description</Label>
                  <TextArea
                    rows={2}
                    placeholder="A description of the annotation configuration"
                  />
                </TextField>
                <RadioGroup
                  value={annotationType}
                  onChange={(value) =>
                    store
                      .getState()
                      .setAnnotationType(value as AnnotationConfigType)
                  }
                  aria-label="Type"
                  data-testid="type-picker"
                  isReadOnly={mode === "edit"}
                >
                  <Label>Annotation Type</Label>
                  {types
                    .filter((type) =>
                      mode === "edit" ? type === annotationType : type
                    )
                    .map((type) => (
                      <Radio key={type} value={type}>
                        {type.charAt(0).toUpperCase() +
                          type.slice(1).toLowerCase()}
                      </Radio>
                    ))}
                  <Text slot="description">
                    Categorical - assign a category - e.g. grade, A, B, C
                    <br />
                    Continuous - assign a score within a range - e.g. 0-1, 0.5
                    <br />
                    Freeform - assign a freeform text comment, e.g.
                    &quot;good&quot;
                  </Text>
                </RadioGroup>
                {(annotationType === "CONTINUOUS" ||
                  annotationType === "CATEGORICAL") && (
                  <RadioGroup
                    value={draft.optimizationDirection}
                    onChange={(value) =>
                      store
                        .getState()
                        .setOptimizationDirection(
                          value as AnnotationConfigOptimizationDirection
                        )
                    }
                    aria-label="Optimization Direction"
                    data-testid="optimization-direction-picker"
                    css={css`
                      height: 100%;
                    `}
                  >
                    <Label>Optimization Direction</Label>
                    {optimizationDirections.map((direction) => (
                      <Radio key={direction} value={direction}>
                        {direction.charAt(0).toUpperCase() +
                          direction.slice(1).toLowerCase()}
                      </Radio>
                    ))}
                    <Text marginTop="auto" slot="description">
                      Maximize - higher the score the better - e.g., correctness
                      <br />
                      Minimize - lower the score the better - e.g., hallucinations
                      <br />
                      None - higher is not better or worse
                      <br />
                    </Text>
                  </RadioGroup>
                )}
                {annotationType === "CONTINUOUS" && (
                  <Flex
                    gap="size-800"
                    css={css`
                      // prevent input from growing when sibling inputs have errors
                      & input {
                        max-height: fit-content;
                      }
                    `}
                  >
                    <NumberField
                      value={toNumberFieldValue(draft.lowerBound)}
                      onChange={(value) =>
                        store
                          .getState()
                          .setLowerBound(Number.isNaN(value) ? null : value)
                      }
                      isInvalid={!!errorFor("lowerBound")}
                    >
                      <Label>Min</Label>
                      <Input placeholder="0" />
                      <FieldError>{errorFor("lowerBound")}</FieldError>
                    </NumberField>
                    <NumberField
                      value={toNumberFieldValue(draft.upperBound)}
                      onChange={(value) =>
                        store
                          .getState()
                          .setUpperBound(Number.isNaN(value) ? null : value)
                      }
                      isInvalid={!!errorFor("upperBound")}
                      minValue={toNumberFieldValue(draft.lowerBound)}
                    >
                      <Label>Max</Label>
                      <Input placeholder="1" />
                      <FieldError>{errorFor("upperBound")}</FieldError>
                    </NumberField>
                  </Flex>
                )}
                {annotationType === "CATEGORICAL" && (
                  <>
                    <Text size="XS" weight="heavy">
                      Categories
                    </Text>
                    {draft.values.map((value, index) => (
                      <Flex
                        key={index}
                        direction="row"
                        gap="size-100"
                        alignItems="start"
                      >
                        <TextField
                          value={value.label}
                          onChange={(label) =>
                            store.getState().updateValue(index, { label })
                          }
                          aria-label={`Value ${index + 1}`}
                          isInvalid={!!errorFor(`values.${index}.label`)}
                          autoFocus={autoFocusedCategoryIndex === index}
                        >
                          <Input
                            placeholder={`e.g. ${ALPHABET[index % ALPHABET.length]}`}
                          />
                          <FieldError>
                            {errorFor(`values.${index}.label`)}
                          </FieldError>
                        </TextField>
                        <NumberField
                          value={toNumberFieldValue(value.score)}
                          onChange={(score) =>
                            store
                              .getState()
                              .updateValue(index, {
                                score: Number.isNaN(score) ? null : score,
                              })
                          }
                          aria-label={`Score ${index + 1}`}
                        >
                          <Flex
                            direction="row"
                            gap="size-100"
                            alignItems="center"
                          >
                            <Input placeholder={`e.g. ${index} (optional)`} />
                          </Flex>
                        </NumberField>
                        <Button
                          type="button"
                          leadingVisual={<Icon svg={<Icons.Trash />} />}
                          aria-label="Remove category"
                          onPress={() => store.getState().removeValue(index)}
                        />
                      </Flex>
                    ))}
                    <Flex justifyContent="end" width="100%">
                      <Button
                        type="button"
                        onPress={() => {
                          const newIndex = draft.values.length;
                          store.getState().addValue();
                          setAutoFocusedCategoryIndex(newIndex);
                        }}
                        leadingVisual={<Icon svg={<Icons.Plus />} />}
                      >
                        Add category
                      </Button>
                    </Flex>
                  </>
                )}
              </Flex>
            </View>
            <View
              paddingX="size-200"
              paddingY="size-200"
              borderTopColor="default"
              borderTopWidth="thin"
            >
              <Flex gap="size-100" justifyContent="end">
                <Button type="button" onPress={close}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {mode === "create"
                    ? "Create Annotation Config"
                    : "Update Annotation Config"}
                </Button>
              </Flex>
            </View>
          </Form>
        </Card>
      )}
    </Dialog>
  );
};
