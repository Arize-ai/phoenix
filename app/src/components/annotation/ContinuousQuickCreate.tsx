import { css } from "@emotion/react";
import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import { Button } from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import type { AnnotationValueDraft } from "@phoenix/components/annotation/AnnotationValueDraft";
import { getOptimizationGradientValueFromConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationConfigContinuous } from "@phoenix/components/annotation/types";

const DEFAULT_NORMALIZED_CONTINUOUS_BOUNDS = new Set([-1, 0, 1]);
const DEFAULT_QUICK_CREATE_INTERVAL_COUNT = 10;

const continuousQuickCreateCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100);

  .continuous-quick-create__values {
    display: grid;
    grid-template-columns: repeat(11, minmax(0, 1fr));
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    gap: var(--global-dimension-size-50);
    list-style: none;
  }

  .continuous-quick-create__option {
    display: flex;
    justify-content: center;
    min-width: 0;
  }

  .continuous-quick-create__button {
    color: inherit;
    font: inherit;
    cursor: pointer;

    &:hover:not([disabled]),
    &[data-hovered]:not([disabled]) {
      > [data-appearance="compact"] {
        color: var(--global-static-color-white-900);
      }
    }

    &:focus-visible,
    &[data-focus-visible] {
      outline: none;

      > [data-appearance="compact"] {
        outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
    }

    &[disabled] {
      cursor: default;
      opacity: var(--global-opacity-disabled);
    }
  }
`;

/** Whether a continuous config has an explicit normalized integer range. */
export function isContinuousQuickCreateConfig({
  config,
  normalizedBounds = DEFAULT_NORMALIZED_CONTINUOUS_BOUNDS,
}: {
  config: AnnotationConfigContinuous;
  normalizedBounds?: ReadonlySet<number>;
}): boolean {
  const { lowerBound, upperBound } = config;
  return (
    typeof lowerBound === "number" &&
    typeof upperBound === "number" &&
    lowerBound < upperBound &&
    normalizedBounds.has(lowerBound) &&
    normalizedBounds.has(upperBound)
  );
}

/** Returns both endpoints and the ten equal intervals between them. */
export function getContinuousQuickCreateValues({
  intervalCount = DEFAULT_QUICK_CREATE_INTERVAL_COUNT,
  lowerBound,
  upperBound,
}: {
  intervalCount?: number;
  lowerBound: number;
  upperBound: number;
}): number[] {
  const interval = (upperBound - lowerBound) / intervalCount;
  return Array.from({ length: intervalCount + 1 }, (_, index) =>
    Number((lowerBound + interval * index).toFixed(10))
  );
}

function formatContinuousQuickCreateScore(score: number): string {
  return score.toFixed(1);
}

export function ContinuousQuickCreate({
  annotationName,
  config,
  onCreate,
}: {
  annotationName: string;
  config: AnnotationConfigContinuous;
  onCreate: (params: {
    shouldExplain: boolean;
    value: AnnotationValueDraft;
  }) => Promise<void>;
}) {
  const [submittingScore, setSubmittingScore] = useState<number | null>(null);
  const lowerBound = config.lowerBound;
  const upperBound = config.upperBound;
  if (typeof lowerBound !== "number" || typeof upperBound !== "number") {
    return null;
  }
  const values = getContinuousQuickCreateValues({ lowerBound, upperBound });
  const getDraft = (score: number): AnnotationValueDraft => ({
    annotatorKind: "HUMAN",
    explanation: "",
    label: null,
    metadata: {},
    score,
    source: "APP",
  });
  const handleCreate = async (score: number) => {
    setSubmittingScore(score);
    await onCreate({ shouldExplain: false, value: getDraft(score) });
    setSubmittingScore(null);
  };
  return (
    <div css={continuousQuickCreateCSS} aria-busy={submittingScore != null}>
      <ol
        className="continuous-quick-create__values"
        aria-label={`${annotationName} values`}
      >
        {values.map((score) => {
          const optimizationValue = getOptimizationGradientValueFromConfig({
            config,
            score,
          });
          const formattedScore = formatContinuousQuickCreateScore(score);
          return (
            <li key={score} className="continuous-quick-create__option">
              <AriaButton
                type="button"
                className="button--reset continuous-quick-create__button"
                isDisabled={submittingScore != null}
                aria-label={`Add ${formattedScore}`}
                onPress={() => void handleCreate(score)}
              >
                <AnnotationScoreText
                  appearance="compact"
                  fontFamily="mono"
                  optimizationValue={optimizationValue}
                >
                  {formattedScore}
                </AnnotationScoreText>
              </AriaButton>
            </li>
          );
        })}
      </ol>
      <Button
        size="S"
        variant="quiet"
        isDisabled={submittingScore != null}
        onPress={() =>
          void onCreate({
            shouldExplain: true,
            value: getDraft(lowerBound),
          })
        }
      >
        Explain
      </Button>
    </div>
  );
}
