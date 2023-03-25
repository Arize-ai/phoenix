import React, { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import { Button, Form, TextField } from "@arizeai/components";

import { MIN_MIN_CLUSTER_SIZE } from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";
export default function ClusteringSettings() {
  const hdbscanParameters = usePointCloudContext(
    (state) => state.hdbscanParameters
  );
  const setHDBSCANParameters = usePointCloudContext(
    (state) => state.setHDBSCANParameters
  );

  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm({
    defaultValues: hdbscanParameters,
  });

  const onSubmit = useCallback(
    (newHDBSCANParameters: typeof hdbscanParameters) => {
      setHDBSCANParameters({
        minClusterSize: parseInt(
          newHDBSCANParameters.minClusterSize as unknown as string,
          10
        ),
        clusterMinSamples: parseInt(
          newHDBSCANParameters.clusterMinSamples as unknown as string,
          10
        ),
        clusterSelectionEpsilon: parseInt(
          newHDBSCANParameters.clusterSelectionEpsilon as unknown as string,
          10
        ),
      });
    },
    [setHDBSCANParameters]
  );
  return (
    <section
      css={css`
        & > .ac-form {
          padding: var(--px-spacing-med) var(--px-spacing-med) 0
            var(--px-spacing-med);
        }
      `}
    >
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="minClusterSize"
          control={control}
          rules={{
            required: "field is required",
            min: {
              value: MIN_MIN_CLUSTER_SIZE,
              message: "must be greater than 1",
            },
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="min cluster size"
              type="number"
              description={`the smallest size for a cluster`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              {...field}
              value={field.value as unknown as string} // TODO: fix type in component
            />
          )}
        />
        <Controller
          name="clusterMinSamples"
          control={control}
          rules={{
            required: "field is required",
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="cluster minimum samples"
              type="number"
              description={`determines if a point is a core point`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              {...field}
              value={field.value as unknown as string} // TODO: fix type in component
            />
          )}
        />
        <Controller
          name="clusterSelectionEpsilon"
          control={control}
          rules={{
            required: "field is required",
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="cluster selection epsilon"
              type="number"
              description={`A distance threshold`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              {...field}
              value={field.value as unknown as string} // TODO: fix type in component
            />
          )}
        />
        <div
          css={css`
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
            margin-top: var(--px-spacing-med);
          `}
        >
          <Button
            variant={isDirty ? "primary" : "default"}
            type="submit"
            isDisabled={!isValid}
            css={css`
              width: 100%;
            `}
          >
            Apply Clustering Config
          </Button>
        </div>
      </Form>
    </section>
  );
}
