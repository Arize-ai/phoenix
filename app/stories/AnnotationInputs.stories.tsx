import React from "react";
import { Form } from "react-aria-components";
import type { Meta, StoryObj } from "@storybook/react";

import { Flex } from "@phoenix/components";
import { AnnotationSaveButton } from "@phoenix/components/annotation/AnnotationSaveButton";
import { CategoricalAnnotationInput } from "@phoenix/components/annotation/CategoricalAnnotationInput";
import { ContinuousAnnotationInput } from "@phoenix/components/annotation/ContinuousAnnotationInput";
import { FreeformAnnotationInput } from "@phoenix/components/annotation/FreeformAnnotationInput";
import {
  AnnotationConfigCategorical,
  AnnotationConfigContinuous,
  AnnotationConfigFreeform,
} from "@phoenix/pages/settings/types";
/**
 * Stories showcasing the annotation input components in a form
 * to test keyboard navigation between different input types.
 */
const meta = {
  title: "Annotation/InputsForm",
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock annotation configs
const categoricalConfig: AnnotationConfigCategorical = {
  id: "category",
  name: "Category",
  annotationType: "CATEGORICAL",
  values: [
    { label: "Option 1", score: null },
    { label: "Option 2", score: null },
    { label: "Option 3", score: null },
  ],
};

const continuousConfig: AnnotationConfigContinuous = {
  id: "rating",
  name: "Rating",
  annotationType: "CONTINUOUS",
  lowerBound: 0,
  upperBound: 10,
};

const freeformConfig: AnnotationConfigFreeform = {
  id: "comment",
  name: "Comments",
  annotationType: "FREEFORM",
  description: "Add any additional comments here",
};

export const Default: Story = {
  render: () => (
    <Form>
      <Flex direction="column" gap="size-400">
        <CategoricalAnnotationInput annotationConfig={categoricalConfig} />

        <ContinuousAnnotationInput
          annotationConfig={continuousConfig}
          defaultValue={5}
        />

        <FreeformAnnotationInput annotationConfig={freeformConfig} />

        <AnnotationSaveButton type="submit">Submit</AnnotationSaveButton>
      </Flex>
    </Form>
  ),
};

export const WithValidation: Story = {
  render: () => (
    <Form>
      <Flex direction="column" gap="size-400">
        <CategoricalAnnotationInput
          annotationConfig={categoricalConfig}
          isRequired
        />

        <ContinuousAnnotationInput
          annotationConfig={continuousConfig}
          defaultValue={5}
        />

        <FreeformAnnotationInput annotationConfig={freeformConfig} isRequired />

        <AnnotationSaveButton type="submit">Submit</AnnotationSaveButton>
      </Flex>
    </Form>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Form>
      <Flex direction="column" gap="size-400">
        <CategoricalAnnotationInput
          annotationConfig={categoricalConfig}
          isDisabled
        />

        <ContinuousAnnotationInput
          annotationConfig={continuousConfig}
          defaultValue={5}
          isDisabled
        />

        <FreeformAnnotationInput annotationConfig={freeformConfig} isDisabled />

        <AnnotationSaveButton type="submit" isDisabled>
          Submit
        </AnnotationSaveButton>
      </Flex>
    </Form>
  ),
};

export const WithDefaultValues: Story = {
  render: () => (
    <Form>
      <Flex direction="column" gap="size-400">
        <CategoricalAnnotationInput
          annotationConfig={categoricalConfig}
          defaultSelectedKey="Option 2"
        />

        <ContinuousAnnotationInput
          annotationConfig={continuousConfig}
          defaultValue={7}
        />

        <FreeformAnnotationInput
          annotationConfig={freeformConfig}
          defaultValue="This is a sample comment with pre-filled text."
        />

        <AnnotationSaveButton type="submit">Submit</AnnotationSaveButton>
      </Flex>
    </Form>
  ),
};

export const MixedSizes: Story = {
  render: () => (
    <Form>
      <Flex direction="column" gap="size-400">
        <CategoricalAnnotationInput
          annotationConfig={categoricalConfig}
          size="S"
        />

        <ContinuousAnnotationInput
          annotationConfig={continuousConfig}
          defaultValue={5}
        />

        <FreeformAnnotationInput annotationConfig={freeformConfig} size="M" />

        <AnnotationSaveButton type="submit">Submit</AnnotationSaveButton>
      </Flex>
    </Form>
  ),
};
