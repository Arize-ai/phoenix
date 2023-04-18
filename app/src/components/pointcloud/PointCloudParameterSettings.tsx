import React, { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  Content,
  ContextualHelp,
  Form,
  Heading,
  Text,
  TextField,
} from "@arizeai/components";

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

import { ExternalLink } from "../ExternalLink";

const nNeighborsContextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      UMAP N Neighbors
    </Heading>

    <Content>
      <Text>
        This parameter controls how UMAP balances local versus global structure
        in the data. It does this by constraining the size of the local
        neighborhood UMAP will look at when attempting to learn the manifold
        structure of the data. This means that low values of n_neighbors will
        force UMAP to concentrate on very local structure (potentially to the
        detriment of the big picture), while large values will push UMAP to look
        at larger neighborhoods of each point when estimating the manifold
        structure of the data, losing fine detail structure for the sake of
        getting the broader of the data.
      </Text>
    </Content>
    <footer>
      <ExternalLink href="https://umap-learn.readthedocs.io/en/latest/parameters.html#n-neighbors">
        View UMAP documentation
      </ExternalLink>
    </footer>
  </ContextualHelp>
);

const minDistContextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      UMAP Minimum Distance
    </Heading>
    <Content>
      <Text>
        The min_dist parameter controls how tightly UMAP is allowed to pack
        points together. It, quite literally, provides the minimum distance
        apart that points are allowed to be in the low dimensional
        representation. This means that low values of min_dist will result in
        clumpier embeddings. This can be useful if you are interested in
        clustering, or in finer topological structure. Larger values of min_dist
        will prevent UMAP from packing points together and will focus on the
        preservation of the broad topological structure instead.
      </Text>
    </Content>
    <footer>
      <ExternalLink href="https://umap-learn.readthedocs.io/en/latest/parameters.html#min-dist">
        View UMAP documentation
      </ExternalLink>
    </footer>
  </ContextualHelp>
);

const nSamplesContextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      Number of Samples
    </Heading>
    <Content>
      <Text elementType="p">
        Determines the number of samples from each dataset to use when
        projecting the point cloud using UMAP. This number is per-dataset so a
        value of 500 means that the point cloud will contain up to 1000 points.
      </Text>
      <br />
      <Text elementType="p">
        For best results keep this value low until you have identified a sample
        that you would like to analyze in more detail.
      </Text>
    </Content>
  </ContextualHelp>
);

export function PointCloudParameterSettings() {
  const umapParameters = usePointCloudContext((state) => state.umapParameters);
  const setUMAPParameters = usePointCloudContext(
    (state) => state.setUMAPParameters,
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
        newUMAPParameters.minDist as unknown as string,
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
          10,
        ),
        nSamples: parseInt(newUMAPParameters.nSamples as unknown as string, 10),
      });
    },
    [setUMAPParameters, setError],
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
            required: "field is required",
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="min distance"
              labelExtra={minDistContextualHelp}
              type="number"
              description={`how tightly to pack points`}
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
              label="n neighbors"
              labelExtra={nNeighborsContextualHelp}
              type="number"
              // @ts-expect-error fix in the component
              step="0.01"
              description={`balances local versus global structure`}
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
              labelExtra={nSamplesContextualHelp}
              defaultValue="500"
              type="number"
              description={`number of points to use per dataset`}
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
