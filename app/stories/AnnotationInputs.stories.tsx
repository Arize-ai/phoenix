import React from "react";
import { FocusScope } from "react-aria";
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
 *
 * Components are wrapped in \<AnnotationFocusProvider \\> to provide focus management.
 */
const meta = {
  title: "AnnotationInputs",
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
    <FocusScope autoFocus contain>
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
    </FocusScope>
  ),
};

export const WithValidation: Story = {
  render: () => (
    <FocusScope autoFocus contain>
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

          <FreeformAnnotationInput
            annotationConfig={freeformConfig}
            isRequired
          />

          <AnnotationSaveButton type="submit">Submit</AnnotationSaveButton>
        </Flex>
      </Form>
    </FocusScope>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FocusScope autoFocus contain>
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

          <FreeformAnnotationInput
            annotationConfig={freeformConfig}
            isDisabled
          />

          <AnnotationSaveButton type="submit" isDisabled>
            Submit
          </AnnotationSaveButton>
        </Flex>
      </Form>
    </FocusScope>
  ),
};

export const WithDefaultValues: Story = {
  render: () => (
    <FocusScope autoFocus contain>
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
    </FocusScope>
  ),
};

export const MixedSizes: Story = {
  render: () => (
    <FocusScope autoFocus contain>
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
    </FocusScope>
  ),
};
