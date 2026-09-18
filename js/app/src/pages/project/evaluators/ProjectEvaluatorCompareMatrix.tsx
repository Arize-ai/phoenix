import { graphql, useFragment } from "react-relay";

import { Card, View } from "@phoenix/components";
import { ConfusionMatrix } from "@phoenix/components/chart";
import { Empty } from "@phoenix/components/core/empty";
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

import { useCompareSelection } from "./projectEvaluatorCompareSelection";

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
  const { selection, setSelection } = useCompareSelection();
  const comparison = useFragment(
    graphql`
      fragment ProjectEvaluatorCompareMatrix_comparison on ProjectEvaluatorComparison {
        evaluationTarget
        coverage {
          evaluatedByBoth
        }
        populationSize
        a {
          annotationName
          labels
          threshold
        }
        b {
          annotationName
          labels
          threshold
        }
        confusionMatrix
      }
    `,
    comparisonRef
  );
  const labelsA = Array.from(comparison.a.labels);
  const labelsB = Array.from(comparison.b.labels);
  const outputAName = getComparedOutputName({
    evaluatorName: evaluatorA.name,
    annotationName: comparison.a.annotationName,
  });
  const outputBName = getComparedOutputName({
    evaluatorName: evaluatorB.name,
    annotationName: comparison.b.annotationName,
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
      subTitle={`${formatMatrixSubtitle({
        target: comparison.evaluationTarget,
        populationSize: comparison.populationSize,
        thresholdA: comparison.a.threshold,
        thresholdB: comparison.b.threshold,
        optimizationDirectionA:
          evaluatorA.evaluator.outputConfigs[0]?.optimizationDirection ?? null,
        optimizationDirectionB:
          evaluatorB.evaluator.outputConfigs[0]?.optimizationDirection ?? null,
      })} · Click a cell to view matching ${comparison.evaluationTarget.toLowerCase()}s`}
    >
      <View padding="size-200">
        {comparison.confusionMatrix.every((row) =>
          row.every((count) => count === 0)
        ) ? (
          <Empty
            message={
              comparison.coverage.evaluatedByBoth === 0
                ? `No shared results for ${evaluatorA.name} and ${evaluatorB.name} in this time range`
                : "No shared results with comparable values"
            }
          />
        ) : (
          <ConfusionMatrix
            selectedCell={
              selection
                ? { actual: selection.a, predicted: selection.b }
                : undefined
            }
            onCellPress={({ actual, predicted }) =>
              setSelection(
                selection?.a === actual && selection.b === predicted
                  ? null
                  : { kind: "matrix", a: actual, b: predicted }
              )
            }
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
        )}
      </View>
    </Card>
  );
}
