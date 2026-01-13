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
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { AnnotationConfigDialog } from "@phoenix/components/annotation/AnnotationConfigDialog";
import { AnnotationConfigTable } from "@phoenix/pages/settings/AnnotationConfigTable";
import {
  settingsAnnotationsPageLoaderGql,
  SettingsAnnotationsPageLoaderType,
} from "@phoenix/pages/settings/settingsAnnotationsPageLoader";
import { AnnotationConfig } from "@phoenix/pages/settings/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { SettingsAnnotationsPageFragment$key } from "./__generated__/SettingsAnnotationsPageFragment.graphql";

export const SettingsAnnotationsPage = () => {
  const loaderData = useLoaderData<SettingsAnnotationsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(settingsAnnotationsPageLoaderGql, loaderData);
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
    const { id: _, annotationType, ...config } = _config;
    const key = annotationType.toLowerCase();
    createAnnotationConfig({
      variables: { input: { annotationConfig: { [key]: config } } },
      onCompleted: () => {
        onCompleted?.();
        refetch();
      },
      onError: parseError(onError),
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
      onError: parseError(onError),
    });
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
      onCompleted: () => {
        onCompleted?.();
        refetch();
      },
      onError: parseError(onError),
    });
  };

  return (
    <Card
      title="Annotation Configs"
      extra={
        <DialogTrigger>
          <Button size="S">
            <Icon svg={<Icons.PlusOutline />} />
            New Configuration
          </Button>
          <ModalOverlay>
            <Modal>
              <AnnotationConfigDialog
                onAddAnnotationConfig={handleAddAnnotationConfig}
              />
            </Modal>
          </ModalOverlay>
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
