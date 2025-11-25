import { Controller, useForm } from "react-hook-form";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import {
  GradientCircle,
  GradientCircleRadio,
  GradientCircleRadioGroup,
} from "@phoenix/components/project";

export type ProjectFormParams = {
  name: string;
  description: string;
  gradientPreset: string;
  gradientStartColor: string;
  gradientEndColor: string;
};

// URI-safe pattern: allows letters, numbers, hyphens, underscores, and dots
const URI_SAFE_PATTERN = /^[a-zA-Z0-9._-]+$/;

// Predefined gradient options
const GRADIENT_PRESETS = [
  {
    id: "blue-purple",
    label: "Blue Purple",
    startColor: "#3B82F6",
    endColor: "#6366F1",
  },
  {
    id: "green-cyan",
    label: "Green Cyan",
    startColor: "#10B981",
    endColor: "#06B6D4",
  },
  {
    id: "purple-pink",
    label: "Purple Pink",
    startColor: "#8B5CF6",
    endColor: "#EC4899",
  },
  {
    id: "orange-yellow",
    label: "Orange Yellow",
    startColor: "#F97316",
    endColor: "#FCD34D",
  },
  {
    id: "pink-red",
    label: "Pink Red",
    startColor: "#EC4899",
    endColor: "#EF4444",
  },
  {
    id: "cyan-blue",
    label: "Cyan Blue",
    startColor: "#06B6D4",
    endColor: "#3B82F6",
  },
  {
    id: "emerald-teal",
    label: "Emerald Teal",
    startColor: "#10B981",
    endColor: "#14B8A6",
  },
  {
    id: "violet-indigo",
    label: "Violet Indigo",
    startColor: "#8B5CF6",
    endColor: "#6366F1",
  },
  {
    id: "rose-pink",
    label: "Rose Pink",
    startColor: "#F43F5E",
    endColor: "#EC4899",
  },
  {
    id: "amber-orange",
    label: "Amber Orange",
    startColor: "#F59E0B",
    endColor: "#F97316",
  },
  {
    id: "lime-green",
    label: "Lime Green",
    startColor: "#84CC16",
    endColor: "#10B981",
  },
  {
    id: "sky-cyan",
    label: "Sky Cyan",
    startColor: "#0EA5E9",
    endColor: "#06B6D4",
  },
] as const;

export function NewProjectForm({
  onSubmit,
  isSubmitting,
  submitButtonText,
}: {
  onSubmit: (params: ProjectFormParams) => void;
  isSubmitting: boolean;
  submitButtonText: string;
}) {
  "use no memo";
  const {
    control,
    handleSubmit,
    watch,
    formState: { isDirty },
  } = useForm<ProjectFormParams>({
    defaultValues: {
      name: "",
      description: "",
      gradientPreset: "blue-purple",
    },
  });

  // Watch form values for preview
  // eslint-disable-next-line react-hooks/incompatible-library
  const currentPreset = watch("gradientPreset");

  // Get current gradient colors based on selection
  const getCurrentGradientColors = () => {
    const preset = GRADIENT_PRESETS.find((p) => p.id === currentPreset);
    return {
      startColor: preset?.startColor || "#3B82F6",
      endColor: preset?.endColor || "#6366F1",
    };
  };

  const { startColor, endColor } = getCurrentGradientColors();

  const handleFormSubmit = (data: ProjectFormParams) => {
    const { startColor: finalStartColor, endColor: finalEndColor } =
      getCurrentGradientColors();
    onSubmit({
      name: data.name,
      description: data.description,
      gradientPreset: data.gradientPreset,
      gradientStartColor: finalStartColor,
      gradientEndColor: finalEndColor,
    });
  };

  return (
    <Form>
      <View padding="size-200">
        {/* Gradient Configuration Section - Moved to top */}
        <View paddingBottom="size-200" marginBottom="size-200">
          <Flex direction="row" gap="size-400" alignItems="center">
            <Flex direction="column" alignItems="center" gap="size-200">
              <GradientCircle
                gradientStartColor={startColor}
                gradientEndColor={endColor}
                size={100}
              />
            </Flex>
            <Controller
              name="gradientPreset"
              control={control}
              render={({ field: { onChange, value } }) => (
                <div css={fieldBaseCSS}>
                  <Label>Project Gradient</Label>
                  <GradientCircleRadioGroup
                    value={value}
                    onChange={onChange}
                    direction="row"
                  >
                    {GRADIENT_PRESETS.map((preset) => (
                      <GradientCircleRadio
                        key={preset.id}
                        value={preset.id}
                        gradientStartColor={preset.startColor}
                        gradientEndColor={preset.endColor}
                        label={preset.label}
                        size={48}
                      />
                    ))}
                  </GradientCircleRadioGroup>
                  <Text slot="description">
                    Select a predefined gradient to help identify your project
                  </Text>
                </div>
              )}
            />
          </Flex>
        </View>
        <Controller
          name="name"
          control={control}
          rules={{
            required: "Project name is required",
            pattern: {
              value: URI_SAFE_PATTERN,
              message:
                "Project name must be URI safe. Use only letters, numbers, hyphens, underscores, and dots. No spaces or special characters.",
            },
            minLength: {
              value: 1,
              message: "Project name must be at least 1 character long",
            },
            maxLength: {
              value: 100,
              message: "Project name must be less than 100 characters long",
            },
          }}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              isInvalid={invalid}
              onChange={onChange}
              onBlur={onBlur}
              value={value.toString()}
            >
              <Label>Project Name</Label>
              <Input placeholder="e.x. my-ai-project" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">
                  The name of the project. Must be URI safe (letters, numbers,
                  hyphens, underscores, dots only).
                </Text>
              )}
            </TextField>
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              isInvalid={invalid}
              onChange={onChange}
              onBlur={onBlur}
              value={value.toString()}
            >
              <Label>Description</Label>
              <TextArea placeholder="e.x. A project for tracking agent performance" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">The description of the project</Text>
              )}
            </TextField>
          )}
        />
      </View>
      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
      >
        <Flex direction="row" justifyContent="end">
          <Button
            isDisabled={isSubmitting}
            variant={isDirty ? "primary" : "default"}
            size="M"
            onPress={() => {
              handleSubmit(handleFormSubmit)();
            }}
          >
            {submitButtonText}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
