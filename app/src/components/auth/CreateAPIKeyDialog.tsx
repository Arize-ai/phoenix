import React from "react";
import { Controller, useForm } from "react-hook-form";
import { Form } from "react-router-dom";
import { isValid as dateIsValid, parseISO } from "date-fns";

import { Dialog, TextArea } from "@arizeai/components";

import {
  Button,
  FieldError,
  Flex,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";

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
                isInvalid={invalid}
                onChange={onChange}
                onBlur={onBlur}
                value={value.toString()}
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
                isInvalid={invalid}
                onChange={onChange}
                onBlur={onBlur}
                value={value.toString()}
              >
                <Label>Expires At</Label>
                <Input type="datetime-local" name={name} />
                {error?.message ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    {"The date at which the key will expire. Optional"}
                  </Text>
                )}
              </TextField>
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
