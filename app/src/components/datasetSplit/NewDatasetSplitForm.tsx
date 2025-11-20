import { Controller, useForm } from "react-hook-form";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
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

export type DatasetSplitParams = {
  name: string;
  description: string;
  color: string;
};

type NewDatasetSplitFormProps = {
  onSubmit: (params: DatasetSplitParams) => void;
  isSubmitting: boolean;
};

export function NewDatasetSplitForm({
  onSubmit,
  isSubmitting,
}: NewDatasetSplitFormProps) {
  "use no memo";
  const {
    control,
    handleSubmit,
    watch,
    formState: { isDirty },
  } = useForm<DatasetSplitParams>({
    defaultValues: {
      name: "",
      description: "",
      color: "#33c5e8",
    },
    mode: "onChange",
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
            {/* eslint-disable-next-line react-hooks/incompatible-library */}
            <Token color={watch("color")}>
              {watch("name") || "split preview"}
            </Token>
          </Flex>
        </View>
        <Controller
          name="name"
          control={control}
          rules={{
            required: "split name is required",
            minLength: {
              value: 1,
              message: "split name must be at least 1 character long",
            },
            maxLength: {
              value: 30,
              message: "split name must be less than 30 characters long",
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
              <Label>Split Name</Label>
              <Input placeholder="e.g. test" />
              {error?.message && <FieldError>{error.message}</FieldError>}
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
              <TextArea placeholder="e.g. a test split" />
              {error?.message && <FieldError>{error.message}</FieldError>}
            </TextField>
          )}
        />
        <Controller
          name="color"
          control={control}
          render={({ field: { onChange, value } }) => (
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
          )}
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
            Create Split
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
