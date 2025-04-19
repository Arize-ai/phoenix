import React from "react";
import { graphql, useFragment, useMutation } from "react-relay";
import { useLoaderData, useRevalidator } from "react-router";

import { Card } from "@arizeai/components";

import { Button, DialogTrigger, Icon, Icons, Modal } from "@phoenix/components";
import { AnnotationConfigDialog } from "@phoenix/pages/settings/AnnotationConfigDialog";
import { AnnotationConfigTable } from "@phoenix/pages/settings/AnnotationConfigTable";
import { SettingsAnnotationsPageLoaderData } from "@phoenix/pages/settings/settingsAnnotationsPageLoader";
import { AnnotationConfig } from "@phoenix/pages/settings/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { SettingsAnnotationsPageFragment$key } from "./__generated__/SettingsAnnotationsPageFragment.graphql";

export const SettingsAnnotationsPage = () => {
  const annotations = useLoaderData() as SettingsAnnotationsPageLoaderData;
  return <SettingsAnnotations annotations={annotations} />;
};

const SettingsAnnotations = ({
  annotations,
}: {
  annotations: SettingsAnnotationsPageFragment$key;
}) => {
  const { revalidate } = useRevalidator();
  const data = useFragment(
    graphql`
      fragment SettingsAnnotationsPageFragment on Query {
        ...AnnotationConfigTableFragment
      }
    `,
    annotations
  );

  const [deleteAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageDeleteAnnotationConfigMutation(
      $input: DeleteAnnotationConfigInput!
    ) {
      deleteAnnotationConfig(input: $input) {
        annotationConfig {
          __typename
        }
      }
    }
  `);

  const [createContinuousAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation(
      $input: CreateContinuousAnnotationConfigInput!
    ) {
      createContinuousAnnotationConfig(input: $input) {
        annotationConfig {
          id
        }
      }
    }
  `);

  const [createCategoricalAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation(
      $input: CreateCategoricalAnnotationConfigInput!
    ) {
      createCategoricalAnnotationConfig(input: $input) {
        annotationConfig {
          id
        }
      }
    }
  `);

  const [createFreeformAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation(
      $input: CreateFreeformAnnotationConfigInput!
    ) {
      createFreeformAnnotationConfig(input: $input) {
        annotationConfig {
          id
        }
      }
    }
  `);

  const parseError = (callback?: (error: string) => void) => (error: Error) => {
    const formattedError = getErrorMessagesFromRelayMutationError(error);
    callback?.(formattedError?.[0] ?? "Failed to create annotation config");
  };

  const handleAddAnnotationConfig = (
    _config: AnnotationConfig,
    {
      onCompleted,
      onError,
    }: { onCompleted?: () => void; onError?: (error: string) => void } = {}
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, annotationType, ...config } = _config;
    switch (annotationType) {
      case "CONTINUOUS":
        createContinuousAnnotationConfig({
          variables: { input: config },
          onCompleted,
          onError: parseError(onError),
        });
        break;
      case "CATEGORICAL":
        createCategoricalAnnotationConfig({
          variables: { input: config },
          onCompleted,
          onError: parseError(onError),
        });
        break;
      case "FREEFORM":
        createFreeformAnnotationConfig({
          variables: { input: config },
          onCompleted,
          onError: parseError(onError),
        });
        break;
    }
    revalidate();
  };

  const [updateContinuousAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation(
      $input: UpdateContinuousAnnotationConfigInput!
    ) {
      updateContinuousAnnotationConfig(input: $input) {
        annotationConfig {
          id
        }
      }
    }
  `);

  const [updateCategoricalAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation(
      $input: UpdateCategoricalAnnotationConfigInput!
    ) {
      updateCategoricalAnnotationConfig(input: $input) {
        annotationConfig {
          id
        }
      }
    }
  `);

  const [updateFreeformAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation(
      $input: UpdateFreeformAnnotationConfigInput!
    ) {
      updateFreeformAnnotationConfig(input: $input) {
        annotationConfig {
          id
        }
      }
    }
  `);

  const handleEditAnnotationConfig = (
    _config: AnnotationConfig,
    {
      onCompleted,
      onError,
    }: { onCompleted?: () => void; onError?: (error: string) => void } = {}
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, annotationType, ...config } = _config;
    switch (annotationType) {
      case "CONTINUOUS":
        updateContinuousAnnotationConfig({
          variables: {
            input: {
              ...config,
              configId: id,
            },
          },
          onCompleted,
          onError: parseError(onError),
        });
        break;
      case "CATEGORICAL":
        updateCategoricalAnnotationConfig({
          variables: {
            input: {
              ...config,
              configId: id,
            },
          },
          onCompleted,
          onError: parseError(onError),
        });
        break;
      case "FREEFORM":
        updateFreeformAnnotationConfig({
          variables: {
            input: {
              ...config,
              configId: id,
            },
          },
          onCompleted,
          onError: parseError(onError),
        });
        break;
    }
    revalidate();
  };

  const handleDeleteAnnotationConfig = (
    id: string,
    {
      onCompleted,
      onError,
    }: { onCompleted?: () => void; onError?: (error: string) => void } = {}
  ) => {
    deleteAnnotationConfig({
      variables: { input: { configId: id } },
      onCompleted,
      onError: parseError(onError),
    });
    revalidate();
  };

  return (
    <Card
      title="Annotation Configs"
      variant="compact"
      bodyStyle={{ padding: 0 }}
      extra={
        <DialogTrigger>
          <Button size="S">
            <Icon svg={<Icons.PlusOutline />} />
            New Configuration
          </Button>
          <Modal>
            <AnnotationConfigDialog
              onAddAnnotationConfig={handleAddAnnotationConfig}
            />
          </Modal>
        </DialogTrigger>
      }
    >
      <AnnotationConfigTable
        annotationConfigs={data}
        onEditAnnotationConfig={handleEditAnnotationConfig}
        onDeleteAnnotationConfig={handleDeleteAnnotationConfig}
      />
    </Card>
  );
};
