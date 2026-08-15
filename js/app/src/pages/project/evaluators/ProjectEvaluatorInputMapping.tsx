import { css } from "@emotion/react";

import {
  Button,
  DialogTrigger,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  Popover,
  PopoverArrow,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { EvaluatorEntityTree } from "@phoenix/components/evaluators/EvaluatorEntityTree";
import { useEvaluatorInputMappingControlsForm } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import {
  dropOtherGrainEntityPathMappings,
  type ProjectEvaluatorMappingSourceGrain,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { isStringKeyedObject } from "@phoenix/typeUtils";

type InputMappingSlot = {
  name: "input" | "output" | "metadata";
  /** What the slot holds when the author leaves it alone. */
  defaultDescription: string;
};

const SPAN_SLOTS: InputMappingSlot[] = [
  { name: "input", defaultDescription: "Defaults to the span's input." },
  { name: "output", defaultDescription: "Defaults to the span's output." },
  {
    name: "metadata",
    defaultDescription:
      "Defaults to the span's attributes, name, kind, and status.",
  },
];

const SESSION_SLOTS: InputMappingSlot[] = [
  {
    name: "input",
    defaultDescription: "Defaults to the session's transcript.",
  },
  {
    name: "output",
    defaultDescription: "Defaults to the last response in the session.",
  },
  {
    name: "metadata",
    defaultDescription: "Defaults to the session's turns.",
  },
];

const GRAIN_LABEL: Record<ProjectEvaluatorMappingSourceGrain, string> = {
  span: "Span",
  session: "Session",
};

/**
 * Where an evaluator's three inputs are read from on the record it runs on.
 *
 * Every evaluator receives the same three: `input`, `output`, and `metadata`.
 * Leaving one alone keeps the value the record already offers; pointing one at
 * a field of the record reads that field instead. Any field of the record is
 * reachable, so nothing about the record is off limits.
 */
export const ProjectEvaluatorInputMapping = ({
  grain,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
}) => {
  const { control, setValue } = useEvaluatorInputMappingControlsForm({
    pruneEmptyEntries: true,
    // Mounted under a key of the grain, so switching what the evaluator runs on
    // rebuilds these rows without the previous record kind's paths in them.
    filterInitialMapping: (inputMapping) =>
      dropOtherGrainEntityPathMappings(inputMapping, grain),
  });
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  // The store's grain follows the evaluated target; a source built for the
  // other grain has no root this grain's paths could be written against.
  const source =
    evaluatorMappingSource.grain === grain
      ? (evaluatorMappingSource.source as Record<string, unknown>)
      : undefined;
  const entityValue = source?.[grain];
  const entity = isStringKeyedObject(entityValue) ? entityValue : {};
  const slots = grain === "session" ? SESSION_SLOTS : SPAN_SLOTS;
  return (
    <Flex direction="column" gap="size-200" width="100%">
      {slots.map((slot) => (
        <SwitchableEvaluatorInput
          key={slot.name}
          fieldName={slot.name}
          label={slot.name}
          description={slot.defaultDescription}
          size="M"
          defaultMode="path"
          control={control}
          setValue={setValue}
          pathOptions={[]}
          literalPlaceholder="Enter a value"
          renderPathInput={({
            value,
            onChange,
            isInvalid,
            errorMessage,
            id,
            ariaLabel,
          }) => (
            <EvaluatorEntityPathField
              value={value}
              onChange={onChange}
              isInvalid={isInvalid}
              errorMessage={errorMessage}
              id={id}
              ariaLabel={ariaLabel}
              entity={entity}
              grain={grain}
            />
          )}
        />
      ))}
    </Flex>
  );
};

/**
 * A path, typed directly or picked from the record. The stored path is the one
 * shown, so an error that quotes a path back names the string in this field.
 */
function EvaluatorEntityPathField({
  value,
  onChange,
  isInvalid,
  errorMessage,
  id,
  ariaLabel,
  entity,
  grain,
}: {
  value: string;
  onChange: (value: string) => void;
  isInvalid: boolean;
  errorMessage?: string;
  id: string;
  ariaLabel: string;
  entity: Record<string, unknown>;
  grain: ProjectEvaluatorMappingSourceGrain;
}) {
  return (
    <div css={pathFieldCSS}>
      <TextField
        isInvalid={isInvalid}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        size="M"
        id={id}
      >
        <Input placeholder={`Leave empty, or read from ${grain}`} />
        {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      </TextField>
      <DialogTrigger>
        <Button
          size="M"
          variant="default"
          aria-label={`Browse ${grain} fields for ${ariaLabel}`}
          leadingVisual={<Icon svg={<Icons.Search />} />}
        />
        <Popover placement="bottom end">
          <PopoverArrow />
          <View width="420px">
            <Flex direction="column">
              <View
                paddingX="size-200"
                paddingTop="size-150"
                paddingBottom="size-50"
              >
                <Text size="S" color="text-500">
                  Choose a field to read this input from. Values shown are from
                  the selected {grain}.
                </Text>
              </View>
              <EvaluatorEntityTree
                entity={entity}
                rootPath={grain}
                rootLabel={GRAIN_LABEL[grain]}
                selectedPath={value}
                onSelectPath={onChange}
              />
            </Flex>
          </View>
        </Popover>
      </DialogTrigger>
    </div>
  );
}

const pathFieldCSS = css`
  display: flex;
  align-items: stretch;
  gap: var(--global-dimension-size-50);

  .text-field {
    flex: 1;
    min-width: 0;
  }
`;
