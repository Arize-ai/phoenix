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

import { MAX_32_BIT_INTEGER } from "@phoenix/constants/numberConstants";
import {
  MIN_CLUSTER_MIN_SAMPLES,
  MIN_MIN_CLUSTER_SIZE,
} from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";

import { ExternalLink } from "../ExternalLink";

const minClusterSizeContextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      Minimum Cluster Size
    </Heading>
    <Content>
      <Text elementType="p">
        The primary parameter to effect the resulting clustering is
        min_cluster_size. Ideally this is a relatively intuitive parameter to
        select – set it to the smallest size grouping that you wish to consider
        a cluster.
      </Text>
    </Content>
    <footer>
      <ExternalLink href="https://hdbscan.readthedocs.io/en/latest/parameter_selection.html#selecting-min-cluster-size">
        View HDBSCAN documentation
      </ExternalLink>
    </footer>
  </ContextualHelp>
);

const minSamplesContextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      Minimum Samples
    </Heading>
    <Content>
      <Text elementType="p">
        The simplest intuition for what min_samples does is provide a measure of
        how conservative you want you clustering to be. The larger the value of
        min_samples you provide, the more conservative the clustering – more
        points will be declared as noise, and clusters will be restricted to
        progressively more dense areas.
      </Text>
    </Content>
    <footer>
      <ExternalLink href="https://hdbscan.readthedocs.io/en/latest/parameter_selection.html#selecting-min-samples">
        View HDBSCAN documentation
      </ExternalLink>
    </footer>
  </ContextualHelp>
);

const clusterSelectionEpsilonContextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      Cluster Selection Epsilon
    </Heading>
    <Content>
      <Text elementType="p">
        In some cases, we want to choose a small min_cluster_size because even
        groups of few points might be of interest to us. However, if our data
        set also contains partitions with high concentrations of objects, this
        parameter setting can result in a large number of micro-clusters.
        Selecting a value for cluster_selection_epsilon helps us to merge
        clusters in these regions. Or in other words, it ensures that clusters
        below the given threshold are not split up any further.
      </Text>
    </Content>
    <footer>
      <ExternalLink href="https://hdbscan.readthedocs.io/en/latest/parameter_selection.html#selecting-cluster-selection-epsilon">
        View HDBSCAN documentation
      </ExternalLink>
    </footer>
  </ContextualHelp>
);

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
            max: {
              value: MAX_32_BIT_INTEGER,
              message: "must be less than 2,147,483,647",
            },
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="min cluster size"
              labelExtra={minClusterSizeContextualHelp}
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
            min: {
              value: MIN_CLUSTER_MIN_SAMPLES,
              message: `must be greater than ${MIN_CLUSTER_MIN_SAMPLES}`,
            },
            max: {
              value: MAX_32_BIT_INTEGER,
              message: "must be less than 2,147,483,647",
            },
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="cluster minimum samples"
              labelExtra={minSamplesContextualHelp}
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
            min: {
              value: 0,
              message: "must be a non-negative number",
            },
            max: {
              value: MAX_32_BIT_INTEGER,
              message: "must be less than 2,147,483,647",
            },
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="cluster selection epsilon"
              labelExtra={clusterSelectionEpsilonContextualHelp}
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
            loading={clustersLoading}
            css={css`
              width: 100%;
            `}
          >
            {clustersLoading
              ? "Applying parameters"
              : "Apply Clustering Config"}
          </Button>
        </div>
      </Form>
    </section>
  );
}
