import { graphql, useFragment } from "react-relay";

import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";
import { SpanFilterConditionProvider } from "@phoenix/pages/project/SpanFilterConditionContext";
import { TracesTable } from "@phoenix/pages/project/TracesTable";

import { DatasetEvaluatorTraces_project$key } from "./__generated__/DatasetEvaluatorTraces_project.graphql";

export function DatasetEvaluatorTraces({
  projectRef,
}: {
  projectRef: DatasetEvaluatorTraces_project$key;
}) {
  const data = useFragment<DatasetEvaluatorTraces_project$key>(
    graphql`
      fragment DatasetEvaluatorTraces_project on Project {
        id
        ...TracesTable_spans
      }
    `,
    projectRef
  );

  return (
    <StreamStateProvider>
      <TracingProvider projectId={data.id} tableId="traces">
        <SpanFilterConditionProvider>
          <TracesTable project={data} />
        </SpanFilterConditionProvider>
      </TracingProvider>
    </StreamStateProvider>
  );
}
