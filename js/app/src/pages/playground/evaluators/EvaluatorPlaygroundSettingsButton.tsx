import {
  Button,
  Checkbox,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
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
 * Display settings for the results panel, behind a gear like the prompt
 * playground's experiment settings. The sample's scope controls live in the
 * Results strip itself.
 */
export function EvaluatorPlaygroundSettingsButton({
  hideExpectedAnnotations,
  onHideExpectedAnnotationsChange,
  isDisabled,
}: {
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
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
