import React from "react";
import { Controller, useForm } from "react-hook-form";
import { Form } from "react-router-dom";
import { isValid as dateIsValid, parseISO } from "date-fns";

import {
  Button,
  Dialog,
  Flex,
  TextArea,
  TextField,
  View,
} from "@arizeai/components";

export type APIKeyFormParams = {
  name: string;
  description: string | null;
  expiresAt: string;
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
      expiresAt: "",
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
                label="Name"
                description="A short name to identify this key"
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                value={value.toString()}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextArea
                label="description"
                description={`A description of the system key`}
                isRequired={false}
                height={100}
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                value={value?.toString()}
              />
            )}
          />
          <Controller
            name="expiresAt"
            control={control}
            rules={{
              validate: (value) => {
                const parsedDate = parseISO(value);
                if (value && !dateIsValid(parsedDate)) {
                  return "Date is not in a valid format";
                }
                if (parsedDate < new Date()) {
                  return "Date must be in the future";
                }
                return true;
              },
            }}
            render={({
              field: { name, onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextField
                label="Expires At"
                type="datetime-local"
                name={name}
                description={`The date at which the key will expire. Optional`}
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                defaultValue={value}
              />
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
              size="compact"
              disabled={!isValid || isCommitting}
            >
              {isCommitting ? "Creating..." : "Create Key"}
            </Button>
          </Flex>
        </View>
      </Form>
    </Dialog>
  );
}
