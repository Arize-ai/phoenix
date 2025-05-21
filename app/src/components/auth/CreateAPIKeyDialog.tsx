import { Controller, useForm } from "react-hook-form";
import { Form } from "react-router";
import { getLocalTimeZone } from "@internationalized/date";
import { css } from "@emotion/react";

import { Dialog } from "@arizeai/components";

import {
  Button,
  DateField,
  DateInput,
  DateSegment,
  DateValue,
  FieldError,
  Flex,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";

export type APIKeyFormParams = {
  name: string;
  description: string | null;
  expiresAt: DateValue | null;
};

/**
 * A dialog that allows admin users to create a system API key.
 */
export function CreateAPIKeyDialog(props: {
  isCommitting: boolean;
  onSubmit: (data: APIKeyFormParams) => void;
  defaultName?: APIKeyFormParams["name"];
}) {
  const { isCommitting, onSubmit, defaultName } = props;
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm<APIKeyFormParams>({
    defaultValues: {
      name: defaultName ?? "New Key",
      description: "",
      expiresAt: null,
    },
  });

  return (
    <Dialog title="Create an API Key" isDismissable>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <View padding="size-200">
          <Controller
            name="name"
            control={control}
            rules={{
              required: "System key name is required",
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
                size="S"
              >
                <Label>Name</Label>
                <Input />
                {error?.message ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">A name to identify the key</Text>
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
                value={value?.toString()}
                size="S"
              >
                <Label>Description</Label>
                <TextArea />
                {error?.message ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    A description of the system key
                  </Text>
                )}
              </TextField>
            )}
          />
          <Controller
            name="expiresAt"
            control={control}
            rules={{
              validate: (value) => {
                if (value && value.toDate(getLocalTimeZone()) < new Date()) {
                  return "Date must be in the future";
                }
                return true;
              },
            }}
            render={({
              field: { name, onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <DateField
                isInvalid={invalid}
                onChange={onChange}
                onBlur={onBlur}
                value={value}
                name={name}
                granularity="minute"
                css={css`
                  .react-aria-DateInput {
                    width: 100%;
                  }
                `}
              >
                <Label>Expires At</Label>
                <DateInput>
                  {(segment) => <DateSegment segment={segment} />}
                </DateInput>
                {error?.message ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    {"The date at which the key will expire. Optional"}
                  </Text>
                )}
              </DateField>
            )}
          />
        </View>
        <View
          paddingStart="size-200"
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderColor="dark"
          borderTopWidth="thin"
        >
          <Flex direction="row" gap="size-100" justifyContent="end">
            <Button
              variant={isDirty ? "primary" : "default"}
              type="submit"
              size="S"
              isDisabled={!isValid || isCommitting}
            >
              {isCommitting ? "Creating..." : "Create Key"}
            </Button>
          </Flex>
        </View>
      </Form>
    </Dialog>
  );
}
