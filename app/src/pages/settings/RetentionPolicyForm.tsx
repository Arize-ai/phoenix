import { Controller, useForm } from "react-hook-form";
import { CronExpressionParser } from "cron-parser";

import {
  Button,
  Flex,
  Form,
  Heading,
  Input,
  Label,
  NumberField,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import {
  createPolicyDeletionSummaryText,
  createPolicyScheduleSummaryText,
} from "@phoenix/utils/retentionPolicyUtils";
export type RetentionPolicyFormParams = {
  name: string;
  numberOfTraces?: number;
  numberOfDays?: number;
  schedule: string;
};

type RetentionPolicyFormProps = {
  onSubmit: (params: RetentionPolicyFormParams) => void;
  mode: "create" | "edit";
  isSubmitting: boolean;
  defaultValues?: RetentionPolicyFormParams;
  onCancel?: () => void;
};
export function RetentionPolicyForm(props: RetentionPolicyFormProps) {
  const { onSubmit, mode, isSubmitting, defaultValues } = props;
  const { control, watch, handleSubmit } = useForm<RetentionPolicyFormParams>({
    defaultValues: defaultValues ?? {
      name: "New Policy",
      numberOfTraces: undefined,
      numberOfDays: 400,
      schedule: "0 0 * * 0",
    },
    mode: "onChange",
  });

  const [numberOfDays, numberOfTraces, schedule] = watch([
    "numberOfDays",
    "numberOfTraces",
    "schedule",
  ]);

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <View padding="size-200">
        <p>
          A retention policy can be defined so that either a certain number of
          traces or traces for a certain amount of time is retained in certain
          projects. If both are defined, the policy will delete traces that are
          either older than the number of days or have more than the number of
          traces, whichever comes first.
        </p>
        <p>
          Once a retention policy is defined, you can associate multiple
          projects to the same policy.
        </p>

        <Flex direction="row" gap="size-100">
          <View flex="1 1 auto">
            <Controller
              control={control}
              name="name"
              rules={{
                required: "Name is required",
              }}
              render={({ field }) => (
                <TextField {...field} size="S" value={field.value}>
                  <Label>Name</Label>
                  <Input />
                  <Text slot="description">
                    The name of the retention policy
                  </Text>
                </TextField>
              )}
            />

            <Controller
              control={control}
              name="numberOfDays"
              rules={{
                required: "Number of days is required. 0 means infinite.",
                min: {
                  value: 0,
                  message: "Number of days must be at least 0",
                },
              }}
              render={({ field }) => (
                <NumberField step={1} size="S" {...field}>
                  <Label>Number of Days</Label>
                  <Input />
                  <Text slot="description">
                    The number of days that will be kept
                  </Text>
                </NumberField>
              )}
            />
            <Controller
              control={control}
              name="numberOfTraces"
              rules={{
                min: {
                  value: 0,
                  message: "Number of traces must be at least 0",
                },
              }}
              render={({ field }) => (
                <NumberField
                  step={1}
                  size="S"
                  value={field.value ?? undefined}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                >
                  <Label>Number of Traces</Label>
                  <Input />
                  <Text slot="description">
                    The number of traces that will be kept
                  </Text>
                </NumberField>
              )}
            />
            <Controller
              control={control}
              name="schedule"
              rules={{
                required: "Schedule is required",
                validate: (value) => {
                  try {
                    const parsed = CronExpressionParser.parse(value);
                    if (!parsed.fields.dayOfMonth.isWildcard) {
                      return "Cannot set day of month, must be *";
                    }
                    if (!parsed.fields.month.isWildcard) {
                      return "Cannot set month, must be *";
                    }
                    if (parsed.fields.minute.values.length >= 1) {
                      const value = parsed.fields.minute.values[0];
                      if (value !== 0) {
                        return "Cannot set minute, must be 0";
                      }
                    }
                  } catch (error) {
                    return error instanceof Error
                      ? error.message
                      : "Invalid cron expression";
                  }
                },
              }}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  size="S"
                  {...field}
                  isInvalid={!!fieldState.error}
                >
                  <Label>Schedule</Label>
                  <Input />
                  {fieldState.error ? (
                    <Text slot="errorMessage" color="danger">
                      {fieldState.error.message}
                    </Text>
                  ) : (
                    <Text slot="description">
                      A cron expression for the hour of the week
                    </Text>
                  )}
                </TextField>
              )}
            />
          </View>
          <View width="300px" paddingX="size-200">
            <Heading level={2}>Retention Policy</Heading>
            <br />
            <Text color="text-700">
              {createPolicyDeletionSummaryText({
                numberOfDays,
                numberOfTraces,
              })}
            </Text>
            <br />
            <br />
            <Text color="text-700">
              {`Enforcement Schedule: ${createPolicyScheduleSummaryText({
                schedule,
              })}`}
            </Text>
          </View>
        </Flex>
      </View>
      <View
        paddingY="size-100"
        paddingX="size-200"
        borderTopWidth="thin"
        borderColor="dark"
      >
        <Flex direction="row" justifyContent="end" gap="size-100">
          <Button size="S" slot="close" onPress={props.onCancel}>
            Cancel
          </Button>
          <Button
            size="S"
            variant="primary"
            type="submit"
            isDisabled={isSubmitting}
          >
            {isSubmitting
              ? "Submitting..."
              : mode === "create"
                ? "Create"
                : "Update"}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
