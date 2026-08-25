import {
  graphql,
  useMutation,
  usePreloadedQuery,
  useRefetchableFragment,
} from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  Card,
  DialogTrigger,
  DocumentationHelp,
  Icon,
  Icons,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { AnnotationConfigDialog } from "@phoenix/components/annotation/AnnotationConfigDialog";
import type { settingsAnnotationsPageLoaderQuery } from "@phoenix/pages/settings/__generated__/settingsAnnotationsPageLoaderQuery.graphql";
import { AnnotationConfigTable } from "@phoenix/pages/settings/AnnotationConfigTable";
import type { SettingsAnnotationsPageLoaderType } from "@phoenix/pages/settings/settingsAnnotationsPageLoader";
import { settingsAnnotationsPageLoaderGql } from "@phoenix/pages/settings/settingsAnnotationsPageLoader";
import type { AnnotationConfig } from "@phoenix/pages/settings/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SettingsAnnotationsPageFragment$key } from "./__generated__/SettingsAnnotationsPageFragment.graphql";

export const SettingsAnnotationsPage = () => {
  const loaderData = useLoaderData<SettingsAnnotationsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<settingsAnnotationsPageLoaderQuery>(
    settingsAnnotationsPageLoaderGql,
    loaderData
  );
  return <SettingsAnnotations annotations={data} />;
};

const SettingsAnnotations = ({
  annotations,
}: {
  annotations: SettingsAnnotationsPageFragment$key;
}) => {
  const [data, _refetch] = useRefetchableFragment(
    graphql`
      fragment SettingsAnnotationsPageFragment on Query
      @refetchable(queryName: "SettingsAnnotationsPageFragmentQuery") {
        ...AnnotationConfigTableFragment
      }
    `,
    annotations
  );

  const refetch = () => {
    // without this fetchPolicy, you won't see changes due to the relay cache
    _refetch({}, { fetchPolicy: "store-and-network" });
  };

  const [deleteAnnotationConfigs] = useMutation(graphql`
    mutation SettingsAnnotationsPageDeleteAnnotationConfigsMutation(
      $input: DeleteAnnotationConfigsInput!
    ) {
      deleteAnnotationConfigs(input: $input) {
        annotationConfigs {
          __typename
        }
      }
    }
  `);

  const [createAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageCreateAnnotationConfigMutation(
      $input: CreateAnnotationConfigInput!
    ) {
      createAnnotationConfig(input: $input) {
        annotationConfig {
          __typename
        }
      }
    }
  `);

  const parseError =
    (fallback: string, callback?: (error: string) => void) =>
    (error: Error) => {
      const formattedError = getErrorMessagesFromRelayMutationError(error);
      callback?.(formattedError?.[0] ?? fallback);
    };

  const handleAddAnnotationConfig = (
    _config: AnnotationConfig,
    {
      onCompleted,
      onError,
    }: { onCompleted?: () => void; onError?: (error: string) => void } = {}
  ) => {
    const { id: _, annotationType, ...config } = _config;
    const key = annotationType.toLowerCase();
    createAnnotationConfig({
      variables: { input: { annotationConfig: { [key]: config } } },
      onCompleted: () => {
        onCompleted?.();
        refetch();
      },
      onError: parseError("Failed to create annotation config", onError),
    });
  };

  const [updateAnnotationConfig] = useMutation(graphql`
    mutation SettingsAnnotationsPageUpdateAnnotationConfigMutation(
      $input: UpdateAnnotationConfigInput!
    ) {
      updateAnnotationConfig(input: $input) {
        query {
          ...AnnotationConfigTableFragment
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
      onCompleted: () => {
        onCompleted?.();
        refetch();
      },
      onError: parseError("Failed to update annotation config", onError),
    });
  };

  const handleDeleteAnnotationConfig = (
    ids: string[],
    {
      onCompleted,
      onError,
    }: { onCompleted?: () => void; onError?: (error: string) => void } = {}
  ) => {
    deleteAnnotationConfigs({
      variables: { input: { ids } },
      onCompleted: () => {
        onCompleted?.();
        refetch();
      },
      onError: parseError("Failed to delete annotation configs", onError),
    });
  };

  return (
    <Card
      title="Annotation Configs"
      titleExtra={
        <DocumentationHelp topic="annotationConfigs">
          Define the labels, scores, and freeform fields people use to annotate
          traces and spans.
        </DocumentationHelp>
      }
      extra={
        <DialogTrigger>
          <Button
            size="S"
            variant="primary"
            leadingVisual={<Icon svg={<Icons.Plus />} />}
          >
            New Configuration
          </Button>
          <ViewportModalOverlay>
            <ViewportModal>
              <AnnotationConfigDialog
                onAddAnnotationConfig={handleAddAnnotationConfig}
              />
            </ViewportModal>
          </ViewportModalOverlay>
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
