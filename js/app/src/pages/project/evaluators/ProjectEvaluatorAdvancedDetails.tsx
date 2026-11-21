import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Card, Text } from "@phoenix/components";
import {
  EvaluatorDetailList,
  EvaluatorDetailRow,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import type { ProjectEvaluatorAdvancedDetails_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorAdvancedDetails_projectEvaluator.graphql";

/**
 * The read-only counterpart of the form's "Advanced" section: settings that
 * change what an evaluation stores, not what it evaluates.
 */
export function ProjectEvaluatorAdvancedDetails({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: ProjectEvaluatorAdvancedDetails_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment ProjectEvaluatorAdvancedDetails_projectEvaluator on ProjectEvaluator {
        tracingEnabled
      }
    `,
    projectEvaluatorRef
  );
  return (
    <Card title="Advanced">
      <EvaluatorDetailList>
        <EvaluatorDetailRow label="Tracing">
          <Text size="S">{projectEvaluator.tracingEnabled ? "On" : "Off"}</Text>
        </EvaluatorDetailRow>
      </EvaluatorDetailList>
    </Card>
  );
}
