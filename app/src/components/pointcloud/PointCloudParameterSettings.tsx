import { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import {
  MAX_INFERENCES_SAMPLE_SIZE,
  MAX_MIN_DIST,
  MAX_N_NEIGHBORS,
  MIN_INFERENCES_SAMPLE_SIZE,
  MIN_MIN_DIST,
  MIN_N_NEIGHBORS,
} from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";
import { UMAPParameters } from "@phoenix/store";

export function PointCloudParameterSettings() {
  const umapParameters = usePointCloudContext((state) => state.umapParameters);
  const setUMAPParameters = usePointCloudContext(
    (state) => state.setUMAPParameters
  );
  const {
    handleSubmit,
    control,
    setError,
    formState: { isDirty, isValid },
  } = useForm({
    reValidateMode: "onChange",
    defaultValues: umapParameters,
  });
  const onSubmit = useCallback(
    (newUMAPParameters: UMAPParameters) => {
      // TODO: fix the types coming back from the component
      const minDist = parseFloat(
        newUMAPParameters.minDist as unknown as string
      );
      if (minDist < MIN_MIN_DIST || minDist > MAX_MIN_DIST) {
        setError("minDist", {
          message: `must be between ${MIN_MIN_DIST} and ${MAX_MIN_DIST}`,
        });

        return;
      }

      setUMAPParameters({
        minDist: minDist,
        nNeighbors: parseInt(
          newUMAPParameters.nNeighbors as unknown as string,
          10
        ),
        nSamples: parseInt(newUMAPParameters.nSamples as unknown as string, 10),
      });
    },
    [setUMAPParameters, setError]
  );

  return (
    <section
      css={css`
        & > .ac-form {
          padding: var(--ac-global-dimension-static-size-100)
            var(--ac-global-dimension-static-size-100) 0
            var(--ac-global-dimension-static-size-100);
        }
      `}
    >
      <Form onSubmit={handleSubmit(onSubmit)}>
        <View padding="size-100">
          <Controller
            name="minDist"
            control={control}
            rules={{
              required: "field is required",
            }}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextField
                type="number"
                isInvalid={invalid}
                onChange={(v) => onChange(parseFloat(v))}
                onBlur={onBlur}
                value={value.toString()}
                size="S"
              >
                <Label>min distance</Label>
                <Input step={0.01} min={MIN_MIN_DIST} max={MAX_MIN_DIST} />
                {error ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">how tightly to pack points</Text>
                )}
              </TextField>
            )}
          />
          <Controller
            name="nNeighbors"
            control={control}
            rules={{
              required: "n neighbors is required",
              min: {
                value: MIN_N_NEIGHBORS,
                message: `greater than or equal to ${MIN_N_NEIGHBORS}`,
              },
              max: {
                value: MAX_N_NEIGHBORS,
                message: `less than or equal to ${MAX_N_NEIGHBORS}`,
              },
            }}
            render={({ field, fieldState: { invalid, error } }) => (
              <TextField
                type="number"
                isInvalid={invalid}
                {...field}
                value={field.value as unknown as string}
                size="S"
              >
                <Label>n neighbors</Label>
                <Input
                  step={0.01}
                  min={MIN_N_NEIGHBORS}
                  max={MAX_N_NEIGHBORS}
                />
                {error ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    Balances local versus global structure
                  </Text>
                )}
              </TextField>
            )}
          />
          <Controller
            name="nSamples"
            control={control}
            rules={{
              required: "n samples is required",
              max: {
                value: MAX_INFERENCES_SAMPLE_SIZE,
                message: `must be below ${MAX_INFERENCES_SAMPLE_SIZE}`,
              },
              min: {
                value: MIN_INFERENCES_SAMPLE_SIZE,
                message: `must be above ${MIN_INFERENCES_SAMPLE_SIZE}`,
              },
            }}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextField
                type="number"
                isInvalid={invalid}
                onChange={(v) => onChange(parseInt(v, 10))}
                onBlur={onBlur}
                value={value.toString()}
                size="S"
              >
                <Label>n samples</Label>
                <Input />
                {error ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    number of points to use per inferences
                  </Text>
                )}
              </TextField>
            )}
          />
          <Button
            variant={isDirty ? "primary" : "default"}
            type="submit"
            isDisabled={!isValid}
            css={css`
              width: 100%;
              margin-top: var(--ac-global-dimension-static-size-100);
            `}
          >
            Apply UMAP Parameters
          </Button>
        </View>
      </Form>
    </section>
  );
}
