import {
  Button,
  Checkbox,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Input,
  Label,
  NumberField,
  Popover,
  PopoverArrow,
  Slider,
  SliderNumberField,
  Text,
  View,
} from "@phoenix/components";

export const DEFAULT_SAMPLE_SIZE = 20;

export const MAX_SAMPLE_SIZE = 500;

/** How many rows a run evaluates at once, by default and at most. */
export const DEFAULT_RUN_CONCURRENCY = 3;

export const MAX_RUN_CONCURRENCY = 10;

/** Reads the sample size from the URL, falling back to the default. */
export function parseSampleSize(value: string | null): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_SAMPLE_SIZE
    ? parsed
    : DEFAULT_SAMPLE_SIZE;
}

/**
 * Evaluator mode's settings, beside Run the way the prompt playground keeps
 * its own: how much of the source a run covers, how many rows it evaluates at
 * once, and what the metadata cells show.
 */
export function EvaluatorPlaygroundConfigButton({
  sampleSize,
  rowNoun,
  onSampleSizeChange,
  concurrency,
  onConcurrencyChange,
  hideExpectedAnnotations,
  onHideExpectedAnnotationsChange,
  isDisabled,
}: {
  sampleSize: number;
  /** What a row is for the selected source kind: "examples" or "spans". */
  rowNoun: "examples" | "spans";
  onSampleSizeChange: (sampleSize: number) => void;
  /** Rows evaluated at the same time during a run. */
  concurrency: number;
  onConcurrencyChange: (concurrency: number) => void;
  /** Leave the `annotations` key out of the metadata cells. */
  hideExpectedAnnotations: boolean;
  onHideExpectedAnnotationsChange: (hide: boolean) => void;
  isDisabled?: boolean;
}) {
  return (
    <DialogTrigger>
      <Button
        size="S"
        aria-label="Playground Settings"
        leadingVisual={<Icon svg={<Icons.Options />} />}
        isDisabled={isDisabled}
      />
      <Popover style={{ width: "360px" }}>
        <PopoverArrow />
        <Dialog>
          <View padding="size-200">
            <Heading level={2} weight="heavy">
              Settings
            </Heading>
            <View
              paddingTop="size-100"
              paddingBottom="size-50"
              overflow="visible" // keeps the slider thumb's halo unclipped
            >
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
                    Evaluators run over the first {rowNoun} of the source
                    {rowNoun === "spans"
                      ? ", newest first, that match the filter"
                      : " and splits"}
                    . Every run re-evaluates the whole sample.
                  </Text>
                </NumberField>
                <Slider
                  label="Concurrency"
                  minValue={1}
                  maxValue={MAX_RUN_CONCURRENCY}
                  value={concurrency}
                  onChange={onConcurrencyChange}
                >
                  <SliderNumberField />
                </Slider>
                <Text color="text-700" size="XS">
                  How many rows a run evaluates at once. Lower it if a provider
                  or sandbox rate-limits the run.
                </Text>
                <Flex direction="column" gap="size-50">
                  <Checkbox
                    isSelected={hideExpectedAnnotations}
                    onChange={onHideExpectedAnnotationsChange}
                  >
                    Hide expected annotations in metadata cells
                  </Checkbox>
                  <Text size="XS" color="text-500">
                    Expected outputs are stored under the row&apos;s
                    &quot;annotations&quot; key and already show in each
                    evaluator&apos;s expected band.
                  </Text>
                </Flex>
              </Flex>
            </View>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
