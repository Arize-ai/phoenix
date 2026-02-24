import { graphql, useFragment } from "react-relay";

import { ProjectProvider } from "@phoenix/contexts/ProjectContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";
import type { DatasetEvaluatorSpans_project$key } from "@phoenix/features/datasets/pages/dataset/evaluators/__generated__/DatasetEvaluatorSpans_project.graphql";
import { SpanFilterConditionProvider } from "@phoenix/features/project/pages/SpanFilterConditionContext";
import { SpansTable } from "@phoenix/features/project/pages/SpansTable";

export function DatasetEvaluatorSpans({
  projectRef,
}: {
  projectRef: DatasetEvaluatorSpans_project$key;
}) {
  const data = useFragment<DatasetEvaluatorSpans_project$key>(
    graphql`
      fragment DatasetEvaluatorSpans_project on Project {
        id
        ...SpansTable_spans
      }
    `,
    projectRef
  );

  return (
    <ProjectProvider projectId={data.id}>
      <StreamStateProvider>
        <TracingProvider projectId={data.id} tableId="spans">
          <SpanFilterConditionProvider>
            <SpansTable project={data} />
          </SpanFilterConditionProvider>
        </TracingProvider>
      </StreamStateProvider>
    </ProjectProvider>
  );
}
