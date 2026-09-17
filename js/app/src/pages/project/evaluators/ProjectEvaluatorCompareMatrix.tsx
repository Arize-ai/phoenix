import { graphql, useFragment } from "react-relay";

import { Card, View } from "@phoenix/components";
import { ConfusionMatrix } from "@phoenix/components/chart";
import type { ProjectEvaluatorCompareMatrix_comparison$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareMatrix_comparison.graphql";
import {
  formatMatrixSubtitle,
  getComparedOutputName,
  toConfusionMatrixData,
} from "@phoenix/pages/project/evaluators/projectEvaluatorCompareUtils";
import type { EvaluatorOptimizationDirection } from "@phoenix/types/evaluators";

export function ProjectEvaluatorCompareMatrix({
  comparisonRef,
  evaluatorAName,
  evaluatorBName,
  evaluatorAOptimizationDirection,
  evaluatorBOptimizationDirection,
}: {
  comparisonRef: ProjectEvaluatorCompareMatrix_comparison$key;
  evaluatorAName: string;
  evaluatorBName: string;
  evaluatorAOptimizationDirection: EvaluatorOptimizationDirection | null;
  evaluatorBOptimizationDirection: EvaluatorOptimizationDirection | null;
}) {
  const comparison = useFragment(
    graphql`
      fragment ProjectEvaluatorCompareMatrix_comparison on ProjectEvaluatorComparison {
        evaluationTarget
        coverage {
          evaluatedByBoth
        }
        sideA {
          annotationName
          labels
          threshold
        }
        sideB {
          annotationName
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
  const outputAName = getComparedOutputName({
    evaluatorName: evaluatorAName,
    annotationName: comparison.sideA.annotationName,
  });
  const outputBName = getComparedOutputName({
    evaluatorName: evaluatorBName,
    annotationName: comparison.sideB.annotationName,
  });
  const axisLabelA = outputAName
    ? `${evaluatorAName} · ${outputAName}`
    : evaluatorAName;
  const axisLabelB = outputBName
    ? `${evaluatorBName} · ${outputBName}`
    : evaluatorBName;

  return (
    <Card
      title="Label overlap"
      titleSeparator={false}
      subTitle={formatMatrixSubtitle({
        target: comparison.evaluationTarget,
        evaluatedByBoth: comparison.coverage.evaluatedByBoth,
        thresholdA: comparison.sideA.threshold,
        thresholdB: comparison.sideB.threshold,
        optimizationDirectionA: evaluatorAOptimizationDirection,
        optimizationDirectionB: evaluatorBOptimizationDirection,
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
          actualAxisLabel={axisLabelA}
          predictedAxisLabel={axisLabelB}
          showTotals
          showPercentage
          legendLabel={`${comparison.evaluationTarget.toLowerCase()} count`}
        />
      </View>
    </Card>
  );
}
