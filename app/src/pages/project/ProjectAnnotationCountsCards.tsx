import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Card, ContentSkeleton, Empty, Text, View } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { tableCSS } from "@phoenix/components/table/styles";

import type { ProjectAnnotationCountsCardsQuery } from "./__generated__/ProjectAnnotationCountsCardsQuery.graphql";

interface ProjectAnnotationCountsCardsProps {
  projectId: string;
}

interface AnnotationNameCount {
  readonly name: string;
  readonly count: number;
}

const LEVELS = [
  {
    title: "Span Annotations",
    emptyMessage: "No span annotations have been added to this project.",
  },
  {
    title: "Trace Annotations",
    emptyMessage: "No trace annotations have been added to this project.",
  },
  {
    title: "Session Annotations",
    emptyMessage: "No session annotations have been added to this project.",
  },
] as const;

/**
 * A set of cards summarizing which annotations have been added to a project at
 * the span, trace, and session levels, along with the number of annotations
 * recorded for each annotation name.
 */
export const ProjectAnnotationCountsCards = (
  props: ProjectAnnotationCountsCardsProps
) => {
  return (
    <Suspense fallback={<ProjectAnnotationCountsCardsFallback />}>
      <ProjectAnnotationCountsCardsContent projectId={props.projectId} />
    </Suspense>
  );
};

const ProjectAnnotationCountsCardsFallback = () => {
  return (
    <>
      {LEVELS.map((level) => (
        <Card key={level.title} title={level.title}>
          <ContentSkeleton />
        </Card>
      ))}
    </>
  );
};

const ProjectAnnotationCountsCardsContent = (
  props: ProjectAnnotationCountsCardsProps
) => {
  const data = useLazyLoadQuery<ProjectAnnotationCountsCardsQuery>(
    graphql`
      query ProjectAnnotationCountsCardsQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            spanAnnotationNameCounts {
              name
              count
            }
            traceAnnotationNameCounts {
              name
              count
            }
            sessionAnnotationNameCounts {
              name
              count
            }
          }
        }
      }
    `,
    { projectId: props.projectId }
  );

  const annotationsByLevel = [
    data.project.spanAnnotationNameCounts ?? [],
    data.project.traceAnnotationNameCounts ?? [],
    data.project.sessionAnnotationNameCounts ?? [],
  ];

  return (
    <>
      {LEVELS.map((level, index) => (
        <AnnotationCountsCard
          key={level.title}
          title={level.title}
          emptyMessage={level.emptyMessage}
          annotations={annotationsByLevel[index]}
        />
      ))}
    </>
  );
};

const totalCountCSS = css`
  color: var(--ac-global-text-color-700);
`;

const countCellCSS = css`
  text-align: right;
  width: 100px;
`;

interface AnnotationCountsCardProps {
  title: string;
  emptyMessage: string;
  annotations: readonly AnnotationNameCount[];
}

const AnnotationCountsCard = (props: AnnotationCountsCardProps) => {
  const { title, emptyMessage, annotations } = props;
  // Sort by count descending, then name ascending, to surface the most
  // heavily annotated names first.
  const sortedAnnotations = [...annotations].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
  const totalCount = annotations.reduce(
    (total, annotation) => total + annotation.count,
    0
  );

  return (
    <Card
      title={title}
      extra={
        <Text css={totalCountCSS} size="S">
          {totalCount.toLocaleString()} total
        </Text>
      }
    >
      {sortedAnnotations.length === 0 ? (
        <View paddingY="size-400">
          <Empty message={emptyMessage} />
        </View>
      ) : (
        <div
          css={css`
            overflow: auto;
          `}
        >
          <table css={tableCSS}>
            <thead>
              <tr>
                <th>Name</th>
                <th css={countCellCSS}>Count</th>
              </tr>
            </thead>
            <tbody>
              {sortedAnnotations.map((annotation) => (
                <tr key={annotation.name}>
                  <td>
                    <AnnotationLabel
                      annotation={{ name: annotation.name }}
                      annotationDisplayPreference="none"
                      css={css`
                        width: fit-content;
                      `}
                    />
                  </td>
                  <td css={countCellCSS}>
                    <Text>{annotation.count.toLocaleString()}</Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
