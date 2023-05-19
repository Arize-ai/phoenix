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
  DEFAULT_CLUSTER_SELECTION_EPSILON,
  DEFAULT_MIN_CLUSTER_SIZE,
  DEFAULT_CLUSTER_MIN_SAMPLES,
  MAX_MIN_CLUSTER_SIZE,
  MIN_MIN_CLUSTER_SIZE,
} from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";
import { HDBSCANParameters } from "@phoenix/store";

import { ExternalLink } from "../ExternalLink";

const minClusterSizeContextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      HDBSCAN Min Cluster Size
    </Heading>
    <Content>
      <Text>TDB</Text>
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
      HDBSCAN Min Samples
    </Heading>
    <Content>
      <Text>TDB</Text>
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
      HDBSCAN Cluster Selection Epsilon
    </Heading>
    <Content>
      <Text>TBD</Text>
    </Content>
    <footer>
      <ExternalLink href="https://hdbscan.readthedocs.io/en/latest/parameter_selection.html#selecting-cluster-selection-epsilon">
        View HDBSCAN documentation
      </ExternalLink>
    </footer>
  </ContextualHelp>
);

export function HDBSCANParameterSettings() {
  const hdbscanParameters = usePointCloudContext(
    (state) => state.hdbscanParameters
  );
  const setHDBSCANParameters = usePointCloudContext(
    (state) => state.setHDBSCANParameters
  );
  const {
    handleSubmit,
    control,
    setError,
    formState: { isDirty, isValid },
  } = useForm({
    reValidateMode: "onChange",
    defaultValues: hdbscanParameters,
  });
  const onSubmit = useCallback(
    (newHDBSCANParameters: HDBSCANParameters) => {
      // TODO: fix the types coming back from the component
      const minClusterSize = parseInt(
        newHDBSCANParameters.minClusterSize as unknown as string,
        10
      );
      if (
        minClusterSize < MIN_MIN_CLUSTER_SIZE ||
        MAX_MIN_CLUSTER_SIZE < minClusterSize
      ) {
        setError("minClusterSize", {
          message: `must be between ${MIN_MIN_CLUSTER_SIZE} and ${MAX_MIN_CLUSTER_SIZE}`,
        });
        return;
      }
      setHDBSCANParameters({
        minClusterSize: minClusterSize,
        minSamples: parseInt(
          newHDBSCANParameters.minSamples as unknown as string,
          10
        ),
        clusterSelectionEpsilon: parseFloat(
          newHDBSCANParameters.clusterSelectionEpsilon as unknown as string
        ),
      });
    },
    [setHDBSCANParameters, setError]
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
            required: "min cluster size is required",
            min: {
              value: MIN_MIN_CLUSTER_SIZE,
              message: `greater than or equal to ${MIN_MIN_CLUSTER_SIZE}`,
            },
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="min cluster size"
              labelExtra={minClusterSizeContextualHelp}
              defaultValue={DEFAULT_MIN_CLUSTER_SIZE.toString()}
              type="number"
              description={`TBD`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              {...field}
              value={field.value as unknown as string} // TODO: fix type in component
            />
          )}
        />
        <Controller
          name="minSamples"
          control={control}
          rules={{
            required: "n neighbors is required",
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="min samples"
              labelExtra={minSamplesContextualHelp}
              defaultValue={DEFAULT_CLUSTER_MIN_SAMPLES.toString()}
              type="number"
              // @ts-expect-error fix in the component
              step="0.01"
              description={`TBD`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              {...field}
              value={field.value as unknown as string}
            />
          )}
        />
        <Controller
          name="clusterSelectionEpsilon"
          control={control}
          rules={{
            required: "cluster selection epsilon is required",
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              label="cluster selection epsilon"
              labelExtra={clusterSelectionEpsilonContextualHelp}
              defaultValue={DEFAULT_CLUSTER_SELECTION_EPSILON.toString()}
              type="number"
              // @ts-expect-error fix in the component
              step="0.01"
              description={`TBD`}
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
            Apply HDBSCAN Parameters
          </Button>
        </div>
      </Form>
    </section>
  );
}
