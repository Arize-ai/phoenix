import { css } from "@emotion/react";
import { useState } from "react";

import { Button, Text } from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import type { AnnotationValueDraft } from "@phoenix/components/annotation/AnnotationValueDraft";
import { getOptimizationGradientValueFromConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationConfigCategorical } from "@phoenix/components/annotation/types";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

const categoricalQuickCreateCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-menu-item-gap);
  margin: 0;
  padding: var(--global-menu-item-gap);
  list-style: none;

  .categorical-quick-create__option {
    display: flex;
    align-items: center;
    gap: var(--global-menu-item-gap);
    padding: var(--global-menu-item-gap);
    border-radius: var(--global-rounding-small);
  }

  .categorical-quick-create__option:hover,
  .categorical-quick-create__option:focus-within {
    background-color: var(--global-menu-item-background-color-hover);
  }

  .categorical-quick-create__value {
    flex: 1;
    min-width: 0;
    justify-content: space-between;
  }

  .categorical-quick-create__value[data-variant="quiet"]:hover:not([disabled]) {
    background-color: transparent;
  }
`;

export type CategoricalQuickCreateProps = {
  annotationName: string;
  config: AnnotationConfigCategorical;
  onCreate: (params: {
    shouldExplain: boolean;
    value: AnnotationValueDraft;
  }) => Promise<void>;
};

/** Quick categorical annotation choices shown from an empty annotation label. */
export function CategoricalQuickCreate({
  annotationName,
  config,
  onCreate,
}: CategoricalQuickCreateProps) {
  const [submittingLabel, setSubmittingLabel] = useState<string | null>(null);
  const handleCreate = async ({
    shouldExplain,
    value,
  }: {
    shouldExplain: boolean;
    value: NonNullable<AnnotationConfigCategorical["values"]>[number];
  }) => {
    setSubmittingLabel(value.label);
    await onCreate({
      shouldExplain,
      value: {
        annotatorKind: "HUMAN",
        explanation: "",
        label: value.label,
        metadata: {},
        score: value.score ?? null,
        source: "APP",
      },
    });
    setSubmittingLabel(null);
  };
  return (
    <ul
      css={categoricalQuickCreateCSS}
      aria-busy={submittingLabel != null}
      aria-label={`${annotationName} values`}
    >
      {(config.values ?? []).map((value) => {
        const optimizationValue = getOptimizationGradientValueFromConfig({
          config,
          score: value.score,
        });
        return (
          <li key={value.label} className="categorical-quick-create__option">
            <Button
              className="categorical-quick-create__value"
              size="S"
              variant="quiet"
              isDisabled={submittingLabel != null}
              aria-label={`Add ${value.label}`}
              onPress={() => void handleCreate({ shouldExplain: false, value })}
            >
              <Text>{value.label}</Text>
              {value.score == null ? (
                <Text fontFamily="mono" color="text-500">
                  —
                </Text>
              ) : (
                <AnnotationScoreText
                  fontFamily="mono"
                  optimizationValue={optimizationValue}
                >
                  {formatFloat(value.score)}
                </AnnotationScoreText>
              )}
            </Button>
            <Button
              size="S"
              variant="quiet"
              isDisabled={submittingLabel != null}
              aria-label={`Add ${value.label} and explain`}
              onPress={() => void handleCreate({ shouldExplain: true, value })}
            >
              Explain
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
