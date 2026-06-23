import { css } from "@emotion/react";
import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldArrayWithId,
  type UseFieldArrayAppend,
  type UseFieldArrayRemove,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";

import type {
  AnnotationConfigDraft,
  PendingAnnotationConfigWrite,
} from "@phoenix/agent/tools/annotationConfig";
import {
  Button,
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
} from "@phoenix/components";

import { ToolPartLabel } from "./ToolPartPrimitives";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const annotationConfigApprovalCSS = css`
  .annotation-config-approval__form {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-150);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-200)
      var(--global-dimension-size-125);
  }

  .annotation-config-approval__metadata {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--global-dimension-size-50);
    font-family: var(--ac-global-font-family-sans);
    white-space: normal;
  }

  .annotation-config-approval__metadata-row {
    display: grid;
    grid-template-columns: minmax(7rem, max-content) minmax(0, 1fr);
    gap: var(--global-dimension-size-150);
    align-items: baseline;
    min-width: 0;
  }

  .annotation-config-approval__metadata-label {
    color: var(--tool-call-secondary-color);
    text-transform: uppercase;
    font-size: var(--global-font-size-xs);
    letter-spacing: 0.05em;
    user-select: none;
  }

  .annotation-config-approval__metadata-value {
    min-width: 0;
    color: var(--global-text-color-900);
    overflow-wrap: anywhere;
  }

  .annotation-config-approval__field-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--global-dimension-size-150);
    align-items: start;
  }

  .annotation-config-approval__category-list {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
  }

  .annotation-config-approval__category-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(7rem, 0.45fr) auto;
    gap: var(--global-dimension-size-100);
    align-items: start;
  }

  .annotation-config-approval__actions {
    padding: var(--global-dimension-size-50) var(--global-dimension-size-200)
      var(--global-dimension-size-150);
  }
`;

const annotationConfigTypes = [
  "categorical",
  "continuous",
  "freeform",
] satisfies AnnotationConfigDraft["type"][];

const optimizationDirections = [
  "MAXIMIZE",
  "MINIMIZE",
  "NONE",
] satisfies NonNullable<AnnotationConfigDraft["optimizationDirection"]>[];

type AnnotationConfigDraftFormValues = {
  type: AnnotationConfigDraft["type"];
  name: string;
  description: string;
  optimizationDirection: NonNullable<
    AnnotationConfigDraft["optimizationDirection"]
  >;
  values: { label: string; score: number | null }[];
  lowerBound: number | null;
  upperBound: number | null;
  threshold: number | null;
};

type AnnotationConfigDraftFormControl =
  Control<AnnotationConfigDraftFormValues>;
type AnnotationConfigCategoryField = FieldArrayWithId<
  AnnotationConfigDraftFormValues,
  "values",
  "id"
>;

/**
 * Inline approval form for an annotation-config write. It lets the user edit
 * the config vocabulary PXI proposed before creating or replacing the config.
 */
export function AnnotationConfigWriteApprovalCard({
  pending,
}: {
  pending: PendingAnnotationConfigWrite;
}) {
  const { preview } = pending;
  const defaultValues = getFormDefaultValues(preview.draft);
  const { control, handleSubmit } = useForm<AnnotationConfigDraftFormValues>({
    defaultValues,
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "values",
  });
  const annotationType = useWatch({ control, name: "type" });
  const lowerBound = useWatch({ control, name: "lowerBound" });
  const canRespond = Boolean(pending.acceptDraft && pending.reject);
  const isUpdate = preview.kind === "update";
  const submitLabel = isUpdate ? "Update config" : "Create config";

  const handleDraftSubmit = (data: AnnotationConfigDraftFormValues) => {
    if (!pending.acceptDraft) {
      return;
    }
    void pending.acceptDraft(buildDraftFromForm(data));
  };

  return (
    <Flex
      direction="column"
      gap="size-100"
      minHeight="0"
      css={annotationConfigApprovalCSS}
    >
      {isUpdate ? (
        <ToolPartLabel variant="danger">
          Replaces the entire config. Any existing label not included here is
          removed.
        </ToolPartLabel>
      ) : null}
      <Form
        className="annotation-config-approval__form"
        onSubmit={(event) => {
          void handleSubmit(handleDraftSubmit)(event);
        }}
      >
        <AnnotationConfigMetadata preview={preview} />
        <div className="annotation-config-approval__field-row">
          <Controller
            name="name"
            control={control}
            rules={{ required: "Name is required" }}
            render={({ field, fieldState: { error } }) => (
              <TextField {...field} isInvalid={!!error}>
                <Label>Name</Label>
                <Input placeholder="e.g. correctness" />
                <FieldError>{error?.message}</FieldError>
              </TextField>
            )}
          />
        </div>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              {...field}
              aria-label="Annotation type"
              isReadOnly={isUpdate}
            >
              <Label>Type</Label>
              {annotationConfigTypes
                .filter((type) => (isUpdate ? type === field.value : true))
                .map((type) => (
                  <Radio key={type} value={type}>
                    {formatAnnotationType(type)}
                  </Radio>
                ))}
            </RadioGroup>
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
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
          )}
        />
        {annotationType === "categorical" || annotationType === "continuous" ? (
          <Controller
            control={control}
            name="optimizationDirection"
            render={({ field }) => (
              <RadioGroup
                {...field}
                aria-label="Optimization direction"
                data-testid="optimization-direction-picker"
              >
                <Label>Optimization direction</Label>
                {optimizationDirections.map((direction) => (
                  <Radio key={direction} value={direction}>
                    {formatOptimizationDirection(direction)}
                  </Radio>
                ))}
                <Text slot="description">
                  Maximize means higher scores are better. Minimize means lower
                  scores are better. None means scores are not ordered.
                </Text>
              </RadioGroup>
            )}
          />
        ) : null}
        {annotationType === "continuous" ? (
          <ContinuousBoundsFields control={control} lowerBound={lowerBound} />
        ) : null}
        {annotationType === "freeform" ? (
          <FreeformScoreFields control={control} lowerBound={lowerBound} />
        ) : null}
        {annotationType === "categorical" ? (
          <CategoricalValuesFields
            control={control}
            fields={fields}
            append={append}
            remove={remove}
          />
        ) : null}
        <div className="annotation-config-approval__actions">
          <Flex direction="row-reverse" gap="size-100">
            <Button
              type="submit"
              size="S"
              variant="primary"
              isDisabled={!canRespond}
            >
              {submitLabel}
            </Button>
            <Button
              type="button"
              size="S"
              isDisabled={!canRespond}
              onPress={() => void pending.reject?.()}
            >
              Reject
            </Button>
          </Flex>
        </div>
      </Form>
      {!canRespond ? (
        <ToolPartLabel>
          This proposal was made in an earlier session and cannot be applied
          here. Re-run your request to have PXI propose it again.
        </ToolPartLabel>
      ) : null}
    </Flex>
  );
}

function AnnotationConfigMetadata({
  preview,
}: {
  preview: PendingAnnotationConfigWrite["preview"];
}) {
  if (preview.kind === "create") {
    return null;
  }
  return (
    <ul className="annotation-config-approval__metadata">
      <MetadataRow label="Config">{preview.configId}</MetadataRow>
    </ul>
  );
}

function MetadataRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="annotation-config-approval__metadata-row">
      <span className="annotation-config-approval__metadata-label">
        {label}
      </span>
      <div className="annotation-config-approval__metadata-value">
        {children}
      </div>
    </li>
  );
}

function ContinuousBoundsFields({
  control,
  lowerBound,
}: {
  control: AnnotationConfigDraftFormControl;
  lowerBound: number | null;
}) {
  return (
    <div className="annotation-config-approval__field-row">
      <OptionalNumberField
        control={control}
        name="lowerBound"
        label="Minimum score"
        placeholder="0"
      />
      <OptionalNumberField
        control={control}
        name="upperBound"
        label="Maximum score"
        placeholder="1"
        validate={(value) => validateUpperBound({ lowerBound, value })}
      />
    </div>
  );
}

function FreeformScoreFields({
  control,
  lowerBound,
}: {
  control: AnnotationConfigDraftFormControl;
  lowerBound: number | null;
}) {
  return (
    <div className="annotation-config-approval__field-row">
      <OptionalNumberField
        control={control}
        name="threshold"
        label="Score threshold"
        placeholder="0.5"
      />
      <OptionalNumberField
        control={control}
        name="lowerBound"
        label="Minimum score"
        placeholder="0"
      />
      <OptionalNumberField
        control={control}
        name="upperBound"
        label="Maximum score"
        placeholder="1"
        validate={(value) => validateUpperBound({ lowerBound, value })}
      />
    </div>
  );
}

function OptionalNumberField({
  control,
  name,
  label,
  placeholder,
  validate,
}: {
  control: AnnotationConfigDraftFormControl;
  name: "lowerBound" | "upperBound" | "threshold";
  label: string;
  placeholder: string;
  validate?: (value: number | null) => true | string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      rules={validate ? { validate } : undefined}
      render={({
        field: { value, onChange, ...field },
        fieldState: { error },
      }) => (
        <NumberField
          {...field}
          value={typeof value === "number" ? value : undefined}
          onChange={(nextValue) =>
            onChange(Number.isNaN(nextValue) ? null : nextValue)
          }
          isInvalid={!!error}
        >
          <Label>{label}</Label>
          <Input placeholder={placeholder} />
          <FieldError>{error?.message}</FieldError>
        </NumberField>
      )}
    />
  );
}

function CategoricalValuesFields({
  control,
  fields,
  append,
  remove,
}: {
  control: AnnotationConfigDraftFormControl;
  fields: AnnotationConfigCategoryField[];
  append: UseFieldArrayAppend<AnnotationConfigDraftFormValues, "values">;
  remove: UseFieldArrayRemove;
}) {
  return (
    <Flex direction="column" gap="size-100">
      <Text size="XS" weight="heavy">
        Categories
      </Text>
      <div className="annotation-config-approval__category-list">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="annotation-config-approval__category-row"
          >
            <Controller
              control={control}
              name={`values.${index}.label`}
              rules={{ required: "Category label is required" }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  aria-label={`Category ${index + 1}`}
                  isInvalid={!!error}
                >
                  <Input
                    placeholder={`e.g. ${ALPHABET[index % ALPHABET.length]}`}
                  />
                  <FieldError>{error?.message}</FieldError>
                </TextField>
              )}
            />
            <Controller
              control={control}
              name={`values.${index}.score`}
              render={({
                field: { value, onChange, ...field },
                fieldState: { error },
              }) => (
                <NumberField
                  {...field}
                  value={typeof value === "number" ? value : undefined}
                  onChange={(nextValue) =>
                    onChange(Number.isNaN(nextValue) ? null : nextValue)
                  }
                  aria-label={`Score ${index + 1}`}
                  isInvalid={!!error}
                >
                  <Input placeholder="optional" />
                  <FieldError>{error?.message}</FieldError>
                </NumberField>
              )}
            />
            <Button
              type="button"
              leadingVisual={<Icon svg={<Icons.Trash />} />}
              aria-label="Remove category"
              isDisabled={fields.length <= 1}
              onPress={() => remove(index)}
            />
          </div>
        ))}
      </div>
      <Flex justifyContent="end" width="100%">
        <Button
          type="button"
          size="S"
          variant="quiet"
          leadingVisual={<Icon svg={<Icons.Plus />} />}
          onPress={() => append({ label: "", score: null })}
        >
          Add category
        </Button>
      </Flex>
    </Flex>
  );
}

function getFormDefaultValues(
  draft: AnnotationConfigDraft
): AnnotationConfigDraftFormValues {
  return {
    type: draft.type,
    name: draft.name,
    description: draft.description ?? "",
    optimizationDirection: draft.optimizationDirection ?? "NONE",
    values:
      draft.values && draft.values.length > 0
        ? draft.values.map((value) => ({
            label: value.label,
            score: value.score ?? null,
          }))
        : [
            { label: "", score: null },
            { label: "", score: null },
          ],
    lowerBound: draft.lowerBound ?? null,
    upperBound: draft.upperBound ?? null,
    threshold: draft.threshold ?? null,
  };
}

function buildDraftFromForm(
  data: AnnotationConfigDraftFormValues
): AnnotationConfigDraft {
  const description = data.description.trim();
  const base = {
    type: data.type,
    name: data.name.trim(),
    description: description.length > 0 ? description : null,
    optimizationDirection: data.optimizationDirection,
  };
  switch (data.type) {
    case "categorical":
      return {
        ...base,
        type: "categorical",
        values: data.values.map((value) => ({
          label: value.label.trim(),
          score: value.score,
        })),
      };
    case "continuous":
      return {
        ...base,
        type: "continuous",
        lowerBound: data.lowerBound,
        upperBound: data.upperBound,
      };
    case "freeform":
      return {
        ...base,
        type: "freeform",
        lowerBound: data.lowerBound,
        upperBound: data.upperBound,
        threshold: data.threshold,
      };
  }
}

function validateUpperBound({
  lowerBound,
  value,
}: {
  lowerBound: number | null;
  value: number | null;
}): true | string {
  if (typeof lowerBound === "number" && typeof value === "number") {
    return value > lowerBound || "Maximum must be greater than minimum";
  }
  return true;
}

function formatAnnotationType(type: AnnotationConfigDraft["type"]): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatOptimizationDirection(
  direction: NonNullable<AnnotationConfigDraft["optimizationDirection"]>
): string {
  return direction.charAt(0).toUpperCase() + direction.slice(1).toLowerCase();
}
