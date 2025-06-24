import type { Meta, StoryObj } from "@storybook/react";

import { ModelForm, TokenPrice } from "../src/pages/settings/ModelForm";

const meta: Meta<typeof ModelForm> = {
  title: "Forms/ModelForm",
  component: ModelForm,
  parameters: {
    layout: "padded",
    controls: { expanded: true },
  },
  argTypes: {
    formMode: {
      control: "select",
      options: ["create", "edit"],
      description:
        "Whether the form is for creating a new model or editing an existing one",
    },
    isSubmitting: {
      control: "boolean",
      description: "Whether the form is currently submitting",
    },
    submitButtonText: {
      control: "text",
      description: "Text displayed on the submit button",
    },
    modelName: {
      control: "text",
      description: "The name of the model",
    },
    modelProvider: {
      control: "text",
      description: "The provider that offers this model",
    },
    modelNamePattern: {
      control: "text",
      description: "Regular expression pattern to match model names",
    },
  },
  args: {
    onSubmit: () => {},
    isSubmitting: false,
    submitButtonText: "Save Model",
    formMode: "create",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const defaultCost = [
  {
    kind: "PROMPT",
    tokenType: "input",
    costPerMillionTokens: 1,
  },
  {
    kind: "COMPLETION",
    tokenType: "output",
    costPerMillionTokens: 2,
  },
] satisfies TokenPrice[];

/**
 * Default form state for creating a new model with empty fields.
 */
export const CreateEmpty: Story = {
  name: "Create - Empty Form",
  args: {
    formMode: "create",
    submitButtonText: "Create Model",
    modelName: null,
    modelProvider: null,
    modelNamePattern: null,
    modelCost: null,
  },
};

/**
 * Create form pre-filled with default OpenAI GPT-4 Turbo values.
 */
export const CreateWithDefaults: Story = {
  name: "Create - With Default Values",
  args: {
    formMode: "create",
    submitButtonText: "Create Model",
    modelName: "gpt-4-turbo",
    modelProvider: "openai",
    modelNamePattern: "^gpt-4-turbo.*",
    modelCost: defaultCost,
  },
};

/**
 * Edit form for an existing Anthropic Claude model with cache pricing.
 */
export const EditExistingModel: Story = {
  name: "Edit - Existing Model",
  args: {
    formMode: "edit",
    submitButtonText: "Update Model",
    modelName: "claude-3-sonnet",
    modelProvider: "anthropic",
    modelNamePattern: "^claude-3-sonnet.*",
    modelCost: defaultCost,
  },
};

/**
 * Edit form showing all cost fields populated, including audio pricing.
 */
export const EditWithAllCosts: Story = {
  name: "Edit - All Cost Fields",
  args: {
    formMode: "edit",
    submitButtonText: "Update Model",
    modelName: "gpt-4o-audio-preview",
    modelProvider: "openai",
    modelNamePattern: "^gpt-4o-audio.*",
    modelCost: defaultCost,
  },
};

/**
 * Form in submitting state with disabled button and loading text.
 */
export const SubmittingState: Story = {
  name: "Submitting",
  args: {
    formMode: "edit",
    submitButtonText: "Updating...",
    isSubmitting: true,
    modelName: "gemini-pro",
    modelProvider: "google",
    modelNamePattern: "^gemini-pro.*",
    modelCost: defaultCost,
  },
};

/**
 * Minimal form with only required fields populated.
 */
export const MinimalRequired: Story = {
  name: "Minimal Required Fields",
  args: {
    formMode: "create",
    submitButtonText: "Create Model",
    modelName: "mistral-7b",
    modelProvider: null,
    modelNamePattern: "mistral.*",
    modelCost: defaultCost,
  },
};

/**
 * Form with a custom provider not in the standard list.
 */
export const CustomProvider: Story = {
  args: {
    formMode: "create",
    submitButtonText: "Create Model",
    modelName: "llama-3-70b",
    modelProvider: "together_ai",
    modelNamePattern: "^llama-3-70b.*",
    modelCost: defaultCost,
  },
};
