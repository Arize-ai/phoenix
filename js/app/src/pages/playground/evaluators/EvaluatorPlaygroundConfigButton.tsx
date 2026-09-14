import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  Slider,
  SliderNumberField,
  Text,
  View,
} from "@phoenix/components";

/** How many rows a run evaluates at once, at most. */
export const MAX_RUN_CONCURRENCY = 10;

/**
 * Evaluator mode's run settings, beside Run the way the prompt playground
 * keeps its own. Settings about the results table (sample size, what the
 * metadata cells show) stay with the table, behind the results strip's gear.
 */
export function EvaluatorPlaygroundConfigButton({
  concurrency,
  onConcurrencyChange,
  isDisabled,
}: {
  /** Rows evaluated at the same time during a run. */
  concurrency: number;
  onConcurrencyChange: (concurrency: number) => void;
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
      <Popover>
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
              </Flex>
            </View>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
