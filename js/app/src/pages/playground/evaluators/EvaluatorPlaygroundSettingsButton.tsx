import {
  Button,
  Checkbox,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  NumberField,
  Popover,
  PopoverArrow,
  Text,
  View,
} from "@phoenix/components";

export const DEFAULT_SAMPLE_SIZE = 20;

export const MAX_SAMPLE_SIZE = 500;

/** Reads the sample size from the URL, falling back to the default. */
export function parseSampleSize(value: string | null): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_SAMPLE_SIZE
    ? parsed
    : DEFAULT_SAMPLE_SIZE;
}

/**
 * Run settings for the results panel, kept behind a gear so the panel header
 * holds one scope control (the dataset) rather than a row of look-alike
 * dropdowns. Mirrors the prompt playground's experiment settings button.
 */
export function EvaluatorPlaygroundSettingsButton({
  sampleSize,
  onSampleSizeChange,
  hideExpectedAnnotations,
  onHideExpectedAnnotationsChange,
  isDisabled,
}: {
  sampleSize: number;
  onSampleSizeChange: (sampleSize: number) => void;
  /** Leave the `annotations` key out of the metadata cells. */
  hideExpectedAnnotations: boolean;
  onHideExpectedAnnotationsChange: (hide: boolean) => void;
  isDisabled?: boolean;
}) {
  return (
    <DialogTrigger>
      <Button
        size="S"
        aria-label="Run settings"
        leadingVisual={<Icon svg={<Icons.Options />} />}
        isDisabled={isDisabled}
      />
      <Popover style={{ width: "360px" }}>
        <PopoverArrow />
        <Dialog>
          <View padding="size-200">
            <Flex direction="column" gap="size-200">
              <NumberField
                size="S"
                value={sampleSize}
                minValue={1}
                maxValue={MAX_SAMPLE_SIZE}
                step={1}
                onChange={(value) => {
                  if (Number.isInteger(value) && value >= 1)
                    onSampleSizeChange(Math.min(value, MAX_SAMPLE_SIZE));
                }}
              >
                <Label>Sample size</Label>
                <Input />
                <Text slot="description">
                  Evaluators run over the first examples of the selected dataset
                  and splits. Every run re-evaluates the whole sample.
                </Text>
              </NumberField>
              <Flex direction="column" gap="size-50">
                <Checkbox
                  isSelected={hideExpectedAnnotations}
                  onChange={onHideExpectedAnnotationsChange}
                >
                  Hide expected annotations in metadata cells
                </Checkbox>
                <Text size="XS" color="text-500">
                  Expected outputs are stored under the example&apos;s
                  &quot;annotations&quot; key and already show in each
                  evaluator&apos;s expected band.
                </Text>
              </Flex>
            </Flex>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
