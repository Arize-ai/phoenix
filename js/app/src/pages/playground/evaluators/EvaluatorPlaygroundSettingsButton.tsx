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
 * Run settings for the results panel, kept behind a gear so the strip holds
 * the source controls rather than a row of look-alike inputs. Mirrors the
 * prompt playground's experiment settings button.
 */
export function EvaluatorPlaygroundSettingsButton({
  sampleSize,
  rowNoun,
  onSampleSizeChange,
  hideExpectedAnnotations,
  onHideExpectedAnnotationsChange,
  isDisabled,
}: {
  sampleSize: number;
  /** What a row is for the selected source kind: "examples" or "spans". */
  rowNoun: "examples" | "spans";
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
        aria-label="Results settings"
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
                  Evaluators run over the first {rowNoun} of the source
                  {rowNoun === "spans"
                    ? ", newest first, that match the filter"
                    : " and splits"}
                  . Every run re-evaluates the whole sample.
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
                  Expected outputs are stored under the row&apos;s
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
