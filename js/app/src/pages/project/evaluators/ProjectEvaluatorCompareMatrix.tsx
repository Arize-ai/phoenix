import { graphql, useFragment } from "react-relay";

import { Card, View } from "@phoenix/components";
import { ConfusionMatrix } from "@phoenix/components/chart";
import type { ProjectEvaluatorCompareMatrix_comparison$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareMatrix_comparison.graphql";
import type { ProjectEvaluatorCompareMatrix_evaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareMatrix_evaluator.graphql";
import {
  formatMatrixSubtitle,
  getComparedOutputName,
  toConfusionMatrixData,
} from "@phoenix/pages/project/evaluators/projectEvaluatorCompareUtils";

const evaluatorFragment = graphql`
  fragment ProjectEvaluatorCompareMatrix_evaluator on ProjectEvaluator {
    name
    evaluator {
      outputConfigs {
        ... on CategoricalAnnotationConfig {
          optimizationDirection
        }
        ... on ContinuousAnnotationConfig {
          optimizationDirection
        }
        ... on FreeformAnnotationConfig {
          optimizationDirection
        }
      }
    }
  }
`;

export function ProjectEvaluatorCompareMatrix({
  comparisonRef,
  evaluatorARef,
  evaluatorBRef,
}: {
  comparisonRef: ProjectEvaluatorCompareMatrix_comparison$key;
  evaluatorARef: ProjectEvaluatorCompareMatrix_evaluator$key;
  evaluatorBRef: ProjectEvaluatorCompareMatrix_evaluator$key;
}) {
  const evaluatorA = useFragment(evaluatorFragment, evaluatorARef);
  const evaluatorB = useFragment(evaluatorFragment, evaluatorBRef);
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
    evaluatorName: evaluatorA.name,
    annotationName: comparison.sideA.annotationName,
  });
  const outputBName = getComparedOutputName({
    evaluatorName: evaluatorB.name,
    annotationName: comparison.sideB.annotationName,
  });
  const axisLabelA = outputAName
    ? `${evaluatorA.name} · ${outputAName}`
    : evaluatorA.name;
  const axisLabelB = outputBName
    ? `${evaluatorB.name} · ${outputBName}`
    : evaluatorB.name;

  return (
    <Card
      title="Label overlap"
      titleSeparator={false}
      subTitle={formatMatrixSubtitle({
        target: comparison.evaluationTarget,
        evaluatedByBoth: comparison.coverage.evaluatedByBoth,
        thresholdA: comparison.sideA.threshold,
        thresholdB: comparison.sideB.threshold,
        optimizationDirectionA:
          evaluatorA.evaluator.outputConfigs[0]?.optimizationDirection ?? null,
        optimizationDirectionB:
          evaluatorB.evaluator.outputConfigs[0]?.optimizationDirection ?? null,
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
