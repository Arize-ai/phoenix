import React, {
  startTransition,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRefetchableFragment,
} from "react-relay";
import {
  CellContext,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import {
  Alert,
  ContentSkeleton,
  Flex,
  Link,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { tableCSS } from "@phoenix/components/table/styles";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { ProjectAnnotationConfigCardContent_project_annotations$key } from "./__generated__/ProjectAnnotationConfigCardContent_project_annotations.graphql";
import { ProjectAnnotationConfigCardContentAddAnnotationConfigToProjectMutation } from "./__generated__/ProjectAnnotationConfigCardContentAddAnnotationConfigToProjectMutation.graphql";
import { ProjectAnnotationConfigCardContentProjectAnnotationsQuery } from "./__generated__/ProjectAnnotationConfigCardContentProjectAnnotationsQuery.graphql";
import { ProjectAnnotationConfigCardContentQuery } from "./__generated__/ProjectAnnotationConfigCardContentQuery.graphql";
import { ProjectAnnotationConfigCardContentRemoveAnnotationConfigFromProjectMutation } from "./__generated__/ProjectAnnotationConfigCardContentRemoveAnnotationConfigFromProjectMutation.graphql";

interface ProjectAnnotationConfigCardProps {
  projectId: string;
}

export const ProjectAnnotationConfigCard = (
  props: ProjectAnnotationConfigCardProps
) => {
  return (
    <Card
      title="Project Annotations"
      variant="compact"
      bodyStyle={{ padding: 0 }}
    >
      <Alert variant="info" banner>
        Annotation Configs are configured globally and can be associated with
        multiple projects. Select the annotation configs you want to use for
        this project.
      </Alert>
      <Suspense fallback={<ContentSkeleton />}>
        <ProjectAnnotationConfigCardContent projectId={props.projectId} />
      </Suspense>
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderTopWidth="thin"
        borderColor="dark"
      >
        <Flex direction="row" justifyContent="end">
          <Link to="/settings/annotations">Configure Annotation Configs</Link>
        </Flex>
      </View>
    </Card>
  );
};

interface AnnotationConfigTableRow {
  id: string;
  name: string;
  annotationType: string;
  isEnabled: boolean;
  isLoading?: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

const columns: ColumnDef<AnnotationConfigTableRow>[] = [
  {
    id: "select",
    maxSize: 10,
    header: () => null,
    cell: ({ row }: CellContext<AnnotationConfigTableRow, unknown>) => (
      <IndeterminateCheckboxCell
        {...{
          checked: row.original.isEnabled,
          disabled: row.original.isLoading,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const annotationConfigId = row.original.id;
            if (!annotationConfigId) {
              throw new Error("Annotation config ID is required");
            }
            if (e.target.checked) {
              row.original.onAdd(annotationConfigId);
            } else {
              row.original.onRemove(annotationConfigId);
            }
          },
        }}
      />
    ),
  },
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: ({ row }: CellContext<AnnotationConfigTableRow, unknown>) => {
      return (
        <AnnotationLabel
          key={row.original.name}
          annotation={{
            name: row.original.name || "",
          }}
          annotationDisplayPreference="none"
          css={css`
            width: fit-content;
          `}
        />
      );
    },
  },
  {
    id: "type",
    header: "Type",
    accessorKey: "annotationType",
    cell: ({ row }: CellContext<AnnotationConfigTableRow, unknown>) => {
      return (
        <Text>
          {row.original.annotationType?.charAt(0).toUpperCase() +
            row.original.annotationType?.slice(1).toLowerCase()}
        </Text>
      );
    },
  },
];

interface ProjectAnnotationConfigCardContentProps {
  projectId: string;
}

const ProjectAnnotationConfigCardContent = (
  props: ProjectAnnotationConfigCardContentProps
) => {
  const { projectId } = props;
  // Keep track of the loading state for each annotation config
  const [loadingConfigs, setLoadingConfigs] = useState<Record<string, boolean>>(
    {}
  );
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const data = useLazyLoadQuery<ProjectAnnotationConfigCardContentQuery>(
    graphql`
      query ProjectAnnotationConfigCardContentQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            ...ProjectAnnotationConfigCardContent_project_annotations
          }
        }
        allAnnotationConfigs: annotationConfigs {
          edges {
            node {
              ... on Node {
                id
              }
              ... on AnnotationConfigBase {
                name
                annotationType
              }
            }
          }
        }
      }
    `,
    { projectId }
  );

  const [projectAnnotationData] = useRefetchableFragment<
    ProjectAnnotationConfigCardContentProjectAnnotationsQuery,
    ProjectAnnotationConfigCardContent_project_annotations$key
  >(
    graphql`
      fragment ProjectAnnotationConfigCardContent_project_annotations on Project
      @refetchable(
        queryName: "ProjectAnnotationConfigCardContentProjectAnnotationsQuery"
      ) {
        annotationConfigs {
          edges {
            node {
              ... on AnnotationConfigBase {
                name
              }
            }
          }
        }
      }
    `,
    data.project
  );

  const [addAnnotationConfigToProjectiMutation] =
    useMutation<ProjectAnnotationConfigCardContentAddAnnotationConfigToProjectMutation>(
      graphql`
        mutation ProjectAnnotationConfigCardContentAddAnnotationConfigToProjectMutation(
          $projectId: ID!
          $annotationConfigId: ID!
        ) {
          addAnnotationConfigToProject(
            input: {
              projectId: $projectId
              annotationConfigId: $annotationConfigId
            }
          ) {
            project {
              ...ProjectAnnotationConfigCardContent_project_annotations
            }
          }
        }
      `
    );

  const [removeAnnotationConfigFromProjectMutation] =
    useMutation<ProjectAnnotationConfigCardContentRemoveAnnotationConfigFromProjectMutation>(
      graphql`
        mutation ProjectAnnotationConfigCardContentRemoveAnnotationConfigFromProjectMutation(
          $projectId: ID!
          $annotationConfigId: ID!
        ) {
          removeAnnotationConfigFromProject(
            input: {
              projectId: $projectId
              annotationConfigId: $annotationConfigId
            }
          ) {
            project {
              ...ProjectAnnotationConfigCardContent_project_annotations
            }
          }
        }
      `
    );

  const addAnnotationConfigToProject = useCallback(
    (annotationConfigId: string) => {
      setLoadingConfigs((prev) => ({ ...prev, [annotationConfigId]: true }));
      startTransition(() => {
        addAnnotationConfigToProjectiMutation({
          variables: {
            projectId,
            annotationConfigId,
          },
          onCompleted: () => {
            setLoadingConfigs((prev) => ({
              ...prev,
              [annotationConfigId]: false,
            }));
            notifySuccess({
              title: "Annotation config added",
              message: "The annotation config has been added to the project.",
            });
          },
          onError: (error) => {
            setLoadingConfigs((prev) => ({
              ...prev,
              [annotationConfigId]: false,
            }));
            notifyError({
              title: "Failed to add annotation config",
              message: error.message || "An unknown error occurred",
            });
          },
        });
      });
    },
    [
      projectId,
      addAnnotationConfigToProjectiMutation,
      notifySuccess,
      notifyError,
    ]
  );

  const removeAnnotationConfigFromProject = useCallback(
    (annotationConfigId: string) => {
      setLoadingConfigs((prev) => ({ ...prev, [annotationConfigId]: true }));
      removeAnnotationConfigFromProjectMutation({
        variables: {
          projectId,
          annotationConfigId,
        },
        onCompleted: () => {
          setLoadingConfigs((prev) => ({
            ...prev,
            [annotationConfigId]: false,
          }));
          notifySuccess({
            title: "Annotation config removed",
            message: "The annotation config has been removed from the project.",
          });
        },
        onError: (error) => {
          setLoadingConfigs((prev) => ({
            ...prev,
            [annotationConfigId]: false,
          }));
          notifyError({
            title: "Failed to remove annotation config",
            message: error.message || "An unknown error occurred",
          });
        },
      });
    },
    [
      projectId,
      removeAnnotationConfigFromProjectMutation,
      notifySuccess,
      notifyError,
    ]
  );

  const { allAnnotationConfigs } = data;

  const tableData = useMemo(() => {
    const projectAnnotationConfigNames =
      projectAnnotationData?.annotationConfigs?.edges.map(
        (edge) => edge?.node?.name
      ) || [];

    return allAnnotationConfigs.edges.map((edge) => ({
      id: edge.node.id || "",
      name: edge.node.name || "",
      annotationType: edge.node.annotationType || "",
      isEnabled: projectAnnotationConfigNames.includes(edge.node.name),
      isLoading: loadingConfigs[edge.node.id || ""],
      onAdd: addAnnotationConfigToProject,
      onRemove: removeAnnotationConfigFromProject,
    })) as AnnotationConfigTableRow[];
  }, [
    allAnnotationConfigs.edges,
    projectAnnotationData,
    loadingConfigs,
    addAnnotationConfigToProject,
    removeAnnotationConfigFromProject,
  ]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (allAnnotationConfigs.edges.length === 0) {
    return (
      <Flex direction="row" justifyContent="center">
        <Text>No annotation configurations available.</Text>
      </Flex>
    );
  }

  return (
    <div
      css={css`
        overflow: auto;
      `}
    >
      <table
        css={tableCSS}
        style={{
          width: table.getTotalSize(),
          minWidth: "100%",
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div
                      style={{
                        left: header.getStart(),
                        width: header.getSize(),
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    width: cell.column.getSize(),
                    maxWidth: cell.column.getSize(),
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
