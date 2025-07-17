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
import { MAX_32_BIT_INTEGER } from "@phoenix/constants/numberConstants";
import {
  MIN_CLUSTER_MIN_SAMPLES,
  MIN_MIN_CLUSTER_SIZE,
} from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";

export default function ClusteringSettings() {
  const hdbscanParameters = usePointCloudContext(
    (state) => state.hdbscanParameters
  );
  const setHDBSCANParameters = usePointCloudContext(
    (state) => state.setHDBSCANParameters
  );
  const clustersLoading = usePointCloudContext(
    (state) => state.clustersLoading
  );

  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
    reset,
  } = useForm({
    defaultValues: hdbscanParameters,
  });

  const onSubmit = useCallback(
    (newHDBSCANParameters: typeof hdbscanParameters) => {
      const values = {
        minClusterSize: parseInt(
          newHDBSCANParameters.minClusterSize as unknown as string,
          10
        ),
        clusterMinSamples: parseInt(
          newHDBSCANParameters.clusterMinSamples as unknown as string,
          10
        ),
        clusterSelectionEpsilon: parseFloat(
          newHDBSCANParameters.clusterSelectionEpsilon as unknown as string
        ),
      };
      setHDBSCANParameters(values);
      reset(values);
    },
    [setHDBSCANParameters, reset]
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
            name="minClusterSize"
            control={control}
            rules={{
              required: "field is required",
              min: {
                value: MIN_MIN_CLUSTER_SIZE,
                message: "must be greater than 1",
              },
              max: {
                value: MAX_32_BIT_INTEGER,
                message: "must be less than 2,147,483,647",
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
                <Label>Min Cluster Size</Label>
                <Input />
                {error ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    The smallest size for a cluster.
                  </Text>
                )}
              </TextField>
            )}
          />
          <Controller
            name="clusterMinSamples"
            control={control}
            rules={{
              required: "field is required",
              min: {
                value: MIN_CLUSTER_MIN_SAMPLES,
                message: `must be greater than ${MIN_CLUSTER_MIN_SAMPLES}`,
              },
              max: {
                value: MAX_32_BIT_INTEGER,
                message: "must be less than 2,147,483,647",
              },
            }}
            render={({
              field: { onBlur, onChange, value },
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
                <Label>Cluster Minimum Samples</Label>
                <Input />
                {error ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    Determines if a point is a core point
                  </Text>
                )}
              </TextField>
            )}
          />
          <Controller
            name="clusterSelectionEpsilon"
            control={control}
            rules={{
              required: "field is required",
              min: {
                value: 0,
                message: "must be a non-negative number",
              },
              max: {
                value: MAX_32_BIT_INTEGER,
                message: "must be less than 2,147,483,647",
              },
            }}
            render={({
              field: { onBlur, onChange, value },
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
                <Label>Cluster Selection Epsilon</Label>
                <Input />
                {error ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">A distance threshold</Text>
                )}
              </TextField>
            )}
          />

          <Button
            variant={isDirty ? "primary" : "default"}
            type="submit"
            isDisabled={!isValid || clustersLoading}
            css={css`
              width: 100%;
              margin-top: var(--ac-global-dimension-static-size-100);
            `}
          >
            {clustersLoading ? "Applying..." : "Apply Clustering Config"}
          </Button>
        </View>
      </Form>
    </section>
  );
}
