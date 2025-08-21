import { useMemo } from "react";

import { ListBox, ListBoxItem } from "@phoenix/components";
import { Annotation } from "@phoenix/components/annotation";
import { useExperimentRunFilterCondition } from "@phoenix/pages/experiment/ExperimentRunFilterConditionContext";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

type AnnotationFilter = {
  text: string;
  condition: string;
};
/**
 * Given a specific set of annotations, shows a set of quick filters to apply to the view
 */
export function ExperimentRunAnnotationFiltersList({
  annotation,
}: {
  annotation: Annotation;
}) {
  const { appendFilterCondition } = useExperimentRunFilterCondition();
  const { name, score, label } = annotation;
  const filters = useMemo<AnnotationFilter[]>(() => {
    if (typeof score === "number") {
      return [
        {
          text: `${name} is ${formatFloat(score)}`,
          condition: `evals['${name}'].score == ${score}`,
        },
        {
          text: `${name} is greater than ${formatFloat(score)}`,
          condition: `evals['${name}'].score > ${score}`,
        },
        {
          text: `${name} is less than ${formatFloat(score)}`,
          condition: `evals['${name}'].score < ${score}`,
        },
      ];
    }
    if (typeof label === "string" && label) {
      return [
        {
          text: `${name} matches ${label}`,
          condition: `evals['${name}'].label == '${label}'`,
        },
        {
          text: `${name} doesn't equal ${label}`,
          condition: `evals['${name}'].label != '${label}'`,
        },
      ];
    }
    return [];
  }, [name, label, score]);
  return (
    <ListBox
      items={filters}
      aria-label="experiment filters"
      selectionMode="single"
      onSelectionChange={(selection) => {
        if (selection === "all") {
          return;
        }
        const condition = selection.keys().next().value;
        if (condition) {
          appendFilterCondition(String(condition));
        }
      }}
    >
      {(filter) => (
        <ListBoxItem key={filter.condition} id={filter.condition}>
          {filter.text}
        </ListBoxItem>
      )}
    </ListBox>
  );
}
