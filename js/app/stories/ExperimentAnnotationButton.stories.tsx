import type { Meta, StoryFn } from "@storybook/react";

import { Button, Card, Flex, Icon, Icons, View } from "@phoenix/components";
import type { Annotation } from "@phoenix/components/annotation";
import { ExperimentAnnotationButton } from "@phoenix/components/experiment/ExperimentAnnotationButton";

const meta: Meta = {
  title: "Experiment/ExperimentAnnotationButton",
  component: ExperimentAnnotationButton,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const failingAnnotation: Annotation = {
  name: "correctness",
  label: "false",
  score: 0,
  explanation: "The output does not answer the question.",
};

const passingAnnotation: Annotation = {
  name: "hallucination",
  label: "factual",
  score: 1,
  explanation: "The output is grounded in the retrieved documents.",
};

const longNameAnnotation: Annotation = {
  name: "a_very_long_annotation_name_that_should_truncate_gracefully",
  label: "somewhat_correct_with_caveats",
  score: 0.4567,
  explanation: "Long content everywhere.",
};

/** The default, container-filling rendering used in experiment tables. */
export const Default: StoryFn = () => (
  <View
    width="360px"
    borderWidth="thin"
    borderColor="default"
    padding="size-100"
  >
    <Flex direction="column">
      <ExperimentAnnotationButton
        annotation={failingAnnotation}
        positiveOptimization={false}
      />
      <ExperimentAnnotationButton
        annotation={passingAnnotation}
        positiveOptimization
      />
    </Flex>
  </View>
);

/** The compact, content-hugging variant used in shrink-to-fit slots. */
export const Compact: StoryFn = () => (
  <Flex direction="column" gap="size-100" alignItems="start">
    <ExperimentAnnotationButton
      annotation={failingAnnotation}
      positiveOptimization={false}
      compact
    />
    <ExperimentAnnotationButton
      annotation={passingAnnotation}
      positiveOptimization
      compact
    />
    <ExperimentAnnotationButton annotation={longNameAnnotation} compact />
  </Flex>
);

/**
 * The composition the compact variant was built for: a card header's `extra`
 * slot, sitting beside a small Button. The chip and the button should read as
 * the same control height.
 */
export const InCardHeader: StoryFn = () => (
  <View width="600px">
    <Card
      collapsible
      title="ChatCompletion"
      extra={
        <Flex direction="row" alignItems="center" gap="size-100">
          <ExperimentAnnotationButton
            annotation={failingAnnotation}
            positiveOptimization={false}
            compact
          />
          <Button
            size="S"
            variant="primary"
            leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
          >
            Test
          </Button>
        </Flex>
      }
    >
      <View padding="size-200">Card body</View>
    </Card>
  </View>
);
