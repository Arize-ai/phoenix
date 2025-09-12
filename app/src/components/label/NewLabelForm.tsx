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
  Token,
  View,
} from "@phoenix/components";
import {
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
} from "@phoenix/components/color";
import { fieldBaseCSS } from "@phoenix/components/field/styles";

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
    watch,
    formState: { isDirty },
  } = useForm<LabelParams>({
    defaultValues: {
      name: "",
      description: "",
      color: "#33c5e8",
    },
  });

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <View padding="size-200">
        <View paddingY="size-300">
          <Flex
            direction="row"
            alignItems="center"
            justifyContent="center"
            width="100%"
          >
            <Token color={watch("color")}>
              {watch("name") || "label preview"}
            </Token>
          </Flex>
        </View>
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
        <Controller
          name="color"
          control={control}
          render={({ field: { onChange, value } }) => {
            return (
              <div css={fieldBaseCSS}>
                <Label>Color</Label>
                <ColorSwatchPicker
                  value={value}
                  onChange={(newColor) => onChange(newColor.toString())}
                >
                  <ColorSwatchPickerItem color="#ff9b88">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#ffa037">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#d7b300">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#98c50a">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#4ecf50">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#49cc93">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#33c5e8">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#78bbfa">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#acafff">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#cca4fd">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#f592f3">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                  <ColorSwatchPickerItem color="#ff95bd">
                    <ColorSwatch size="L" />
                  </ColorSwatchPickerItem>
                </ColorSwatchPicker>
              </div>
            );
          }}
        />
      </View>
      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-200"
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
