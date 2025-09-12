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

export type LabelParams = {
  name: string;
  description: string;
  color: string;
};

type NewLabelFormProps = {
  onSubmit: (params: LabelParams) => void;
  isSubmitting: boolean;
};
export function NewLabelForm({ onSubmit, isSubmitting }: NewLabelFormProps) {
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<LabelParams>({
    defaultValues: {
      name: "",
      description: "",
      color: "#ffffff",
    },
  });
  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <View padding="size-100">
        <Controller
          name="name"
          control={control}
          rules={{
            required: "label name is required",
            minLength: {
              value: 1,
              message: "label name must be at least 1 character long",
            },
            maxLength: {
              value: 30,
              message: "label name must be less than 30 characters long",
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
              <Label>Label Name</Label>
              <Input placeholder="e.x. classifier" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">The name of the label</Text>
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
              <TextArea placeholder="A short description" />
              {error?.message ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">The description of the label</Text>
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
            type="submit"
          >
            Create Label
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
