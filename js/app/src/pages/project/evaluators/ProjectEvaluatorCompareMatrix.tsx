import { graphql, useFragment } from "react-relay";

import { Card, View } from "@phoenix/components";
import { ConfusionMatrix } from "@phoenix/components/chart";
import type { ProjectEvaluatorCompareMatrix_comparison$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareMatrix_comparison.graphql";
import {
  formatMatrixSubtitle,
  getPositiveLabel,
  toConfusionMatrixData,
} from "@phoenix/pages/project/evaluators/projectEvaluatorCompareUtils";

export function ProjectEvaluatorCompareMatrix({
  comparisonRef,
  evaluatorAName,
  evaluatorBName,
}: {
  comparisonRef: ProjectEvaluatorCompareMatrix_comparison$key;
  evaluatorAName: string;
  evaluatorBName: string;
}) {
  const comparison = useFragment(
    graphql`
      fragment ProjectEvaluatorCompareMatrix_comparison on ProjectEvaluatorComparison {
        evaluationTarget
        coverage {
          evaluatedByBoth
        }
        sideA {
          labels
          threshold
        }
        sideB {
          labels
          threshold
        }
        confusionMatrix
      }
    `,
    comparisonRef
  );
  const labelsA = Array.from(comparison.sideA.labels);
  const labelsB = Array.from(comparison.sideB.labels);

  return (
    <Card
      title="Label overlap"
      subTitle={formatMatrixSubtitle({
        target: comparison.evaluationTarget,
        evaluatedByBoth: comparison.coverage.evaluatedByBoth,
        thresholdA: comparison.sideA.threshold,
        thresholdB: comparison.sideB.threshold,
      })}
    >
      <View padding="size-200">
        <ConfusionMatrix
          data={toConfusionMatrixData({
            matrix: comparison.confusionMatrix,
            rowLabels: labelsA,
            columnLabels: labelsB,
          })}
          actualLabels={labelsA}
          predictedLabels={labelsB}
          actualAxisLabel={evaluatorAName}
          predictedAxisLabel={evaluatorBName}
          scaleType="log"
          showTotals
          showPercentage
          legendLabel={`${comparison.evaluationTarget.toLowerCase()} count · log scale`}
          positiveLabel={getPositiveLabel(labelsA, labelsB)}
        />
      </View>
    </Card>
  );
}
