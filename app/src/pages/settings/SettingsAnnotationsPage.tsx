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

  const [deleteAnnotationConfigs] = useMutation(graphql`
    mutation SettingsAnnotationsPageDeleteAnnotationConfigsMutation(
      $input: DeleteAnnotationConfigsInput!
    ) {
      deleteAnnotationConfigs(input: $input) {
        query {
          ...AnnotationConfigTableFragment
        }
      }
    }
  `);

  const [createAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageCreateAnnotationConfigMutation(
      $input: CreateAnnotationConfigInput!
    ) {
      createAnnotationConfig(input: $input) {
        query {
          ...AnnotationConfigTableFragment
        }
        annotationConfig {
          ... on ContinuousAnnotationConfig {
            id
          }
          ... on CategoricalAnnotationConfig {
            id
          }
          ... on FreeformAnnotationConfig {
            id
          }
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
    const key = annotationType.toLowerCase();
    createAnnotationConfig({
      variables: { input: { annotationConfig: { [key]: config } } },
      onCompleted,
      onError: parseError(onError),
    });
    revalidate();
  };

  const [updateAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageUpdateAnnotationConfigMutation(
      $input: UpdateAnnotationConfigInput!
    ) {
      updateAnnotationConfig(input: $input) {
        query {
          ...AnnotationConfigTableFragment
        }
        annotationConfig {
          ... on ContinuousAnnotationConfig {
            id
          }
          ... on CategoricalAnnotationConfig {
            id
          }
          ... on FreeformAnnotationConfig {
            id
          }
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
    const key = annotationType.toLowerCase();
    updateAnnotationConfig({
      variables: {
        input: {
          id,
          annotationConfig: {
            [key]: config,
          },
        },
      },
      onCompleted,
      onError: parseError(onError),
    });
    revalidate();
  };

  const handleDeleteAnnotationConfig = (
    id: string,
    {
      onCompleted,
      onError,
    }: { onCompleted?: () => void; onError?: (error: string) => void } = {}
  ) => {
    deleteAnnotationConfigs({
      variables: { input: { ids: [id] } },
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
