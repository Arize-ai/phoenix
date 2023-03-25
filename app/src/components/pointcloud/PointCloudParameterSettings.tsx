import React, { startTransition, useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import { Button, Form, TextField } from "@arizeai/components";

import {
  MAX_DATASET_SAMPLE_SIZE,
  MAX_MIN_DIST,
  MAX_N_NEIGHBORS,
  MIN_DATASET_SAMPLE_SIZE,
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
      startTransition(() => {
        setUMAPParameters({
          minDist: minDist,
          nNeighbors: parseInt(
            newUMAPParameters.nNeighbors as unknown as string,
            10
          ),
          nSamples: parseInt(
            newUMAPParameters.nSamples as unknown as string,
            10
          ),
        });
      });
    },
    [setUMAPParameters, setError]
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
          name="minDist"
          control={control}
          rules={{
            required: "min dist is required",
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="min distance"
              type="number"
              description={`a number between ${MIN_MIN_DIST} and ${MAX_MIN_DIST}`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              {...field}
              value={field.value as unknown as string} // TODO: fix type in component
            />
          )}
        />
        <Controller
          name="nNeighbors"
          control={control}
          rules={{
            required: "n neighbors is required",
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="n neighbors"
              type="number"
              // @ts-expect-error fix in the component
              step="0.01"
              description={`a number between ${MIN_N_NEIGHBORS} and ${MAX_N_NEIGHBORS}`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              {...field}
              value={field.value as unknown as string}
            />
          )}
        />
        <Controller
          name="nSamples"
          control={control}
          rules={{
            required: "n samples is required",
            max: {
              value: MAX_DATASET_SAMPLE_SIZE,
              message: `must be below ${MAX_DATASET_SAMPLE_SIZE}`,
            },
            min: {
              value: MIN_DATASET_SAMPLE_SIZE,
              message: `must be above ${MIN_DATASET_SAMPLE_SIZE}`,
            },
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="n samples"
              defaultValue="500"
              type="number"
              description={`a number between ${MIN_DATASET_SAMPLE_SIZE} and ${MAX_DATASET_SAMPLE_SIZE}`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              {...field}
              value={field.value as unknown as string}
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
            Apply UMAP Parameters
          </Button>
        </div>
      </Form>
    </section>
  );
}
