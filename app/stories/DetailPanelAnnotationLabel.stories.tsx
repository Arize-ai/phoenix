import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useRef } from "react";

import { Flex, Text, View } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { useDimensions } from "@phoenix/hooks";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

type AnnotationValueExample = {
  id: string;
  name?: string;
  score: number | null;
  label: string | null;
  explanation: string | null;
};

const LONG_LABEL =
  "mostly_correct_with_minor_caveats_requiring_additional_review_before_release";
const LONG_EXPLANATION =
  "The response reaches the right conclusion, but it relies on several unstated assumptions, omits an important boundary condition, and should cite the source used to support the final recommendation before it is shown to a customer.";

const CHARACTER_VALUE_EXAMPLES: AnnotationValueExample[] = [
  {
    id: "narrow-characters",
    name: "iiiiiiiiiiiiiiiiiiiiiiiiiiii",
    score: null,
    label: "llllllllllllllllllllllllllllllllllllllllllllllllllll",
    explanation: "Narrow glyphs leave room for more characters.",
  },
  {
    id: "wide-characters",
    name: "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    score: null,
    label: "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM",
    explanation: "Wide glyphs reach the truncation boundary sooner.",
  },
  {
    id: "mixed-characters",
    name: "minimumWidth_WMWM_illil_review",
    score: null,
    label: "illil_WMWM_minimumWidth_illil_WMWM_minimumWidth",
    explanation: "Mixed glyph widths produce a different final boundary.",
  },
  {
    id: "punctuation-characters",
    name: "quality/check::release_candidate",
    score: null,
    label: "pass---with___caveats///pending::final-review",
    explanation: "Punctuation exposes its own spacing and side bearings.",
  },
];

const VALUE_EXAMPLES: AnnotationValueExample[] = [
  {
    id: "nothing",
    score: null,
    label: null,
    explanation: null,
  },
  {
    id: "score-only",
    score: 0,
    label: null,
    explanation: null,
  },
  {
    id: "label-only",
    score: null,
    label: "A",
    explanation: null,
  },
  {
    id: "explanation-only",
    score: null,
    label: null,
    explanation: "OK",
  },
  {
    id: "score-and-label",
    score: 0.87654321,
    label: "mostly correct",
    explanation: null,
  },
  {
    id: "score-and-explanation",
    score: -0.25,
    label: null,
    explanation: "The response contains one unsupported claim.",
  },
  {
    id: "label-and-explanation",
    score: null,
    label: LONG_LABEL,
    explanation: LONG_EXPLANATION,
  },
  {
    id: "everything",
    score: 1,
    label: "pass",
    explanation: "Fully correct and concise.",
  },
];

const COMPARISON_EXAMPLES: AnnotationValueExample[] = [
  ...CHARACTER_VALUE_EXAMPLES,
  ...CHARACTER_VALUE_EXAMPLES.map((example) => ({
    ...example,
    id: `${example.id}-with-score`,
    score: 0.123456,
  })),
];

const INLINE_FLOW_EXAMPLES: AnnotationValueExample[] = [
  {
    id: "quality",
    name: "quality",
    score: 1,
    label: "pass",
    explanation: null,
  },
  {
    id: "toxicity",
    name: "toxicity",
    score: 0.02,
    label: "safe",
    explanation: null,
  },
  {
    id: "relevance",
    name: "relevance",
    score: 0.98,
    label: "highly relevant",
    explanation: null,
  },
  {
    id: "tone",
    name: "tone",
    score: null,
    label: "formal",
    explanation: null,
  },
  {
    id: "helpfulness",
    name: "helpfulness",
    score: 0.74,
    label: null,
    explanation: null,
  },
  {
    id: "citation-correctness",
    name: "citation correctness",
    score: 0.91,
    label: "all claims supported",
    explanation: null,
  },
  {
    id: "groundedness",
    name: "groundedness",
    score: 0.63,
    label: "partially grounded with caveats",
    explanation: null,
  },
  {
    id: "narrow-inline",
    name: "iiiiiiiiiiiiiiiiiiii",
    score: 0.12,
    label: "llllllllllllllllllllllllllllllllllllllll",
    explanation: null,
  },
  {
    id: "wide-inline",
    name: "WWWWWWWWWWWWWWWWWWWW",
    score: 0.12,
    label: "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM",
    explanation: null,
  },
  {
    id: "format",
    name: "format",
    score: 1,
    label: "JSON",
    explanation: null,
  },
  {
    id: "response-length",
    name: "response length",
    score: 0.88,
    label: "concise",
    explanation: null,
  },
  {
    id: "pii",
    name: "personally identifiable information",
    score: 1,
    label: "no PII detected",
    explanation: null,
  },
  {
    id: "retrieval-relevance",
    name: "retrieval document relevance",
    score: 0.66,
    label: "relevant",
    explanation: null,
  },
  {
    id: "reference-match",
    name: "answer matches reference with minor differences",
    score: 0.79,
    label: "mostly correct with one omission",
    explanation: null,
  },
  {
    id: "minimal",
    name: "x",
    score: null,
    label: null,
    explanation: null,
  },
  {
    id: "completeness",
    name: "completeness",
    score: 0.93,
    label: "comprehensive",
    explanation: null,
  },
  {
    id: "tool-arguments",
    name: "tool call argument validation",
    score: 0.97,
    label: "valid",
    explanation: null,
  },
  {
    id: "hallucination-risk",
    name: "hallucination risk requiring manual review",
    score: 0.31,
    label: "requires manual review before release",
    explanation: null,
  },
];

const INLINE_FLOW_CONTENT_WIDTH = 582;
const INLINE_FLOW_GAP = 8;
const MIN_PACKED_ANNOTATION_WIDTH = 96;
const MAX_TEXT_WIDTH = 144;
const ANNOTATION_CHROME_WIDTH = 26;
const VALUE_DIVIDER_AND_GAPS_WIDTH = 17;
const MIN_NAME_PREVIEW_WIDTH = 64;
const MIN_LABEL_PREVIEW_WIDTH = 40;
const CENTER_TRUNCATION_PREFIX_LENGTH = 3;
const CENTER_TRUNCATION_SUFFIX_LENGTH = 3;
const NAME_FONT = '600 14px "Geist", sans-serif';
const VALUE_FONT = '400 14px "Geist", sans-serif';
const SCORE_FONT = '400 14px "Geist Mono", monospace';

type PackedInlineExample = {
  example: AnnotationValueExample;
  width: number;
};

type AnnotationTextWidths = {
  label: number;
  name: number;
  score: number;
  value: number;
};

function getPretextWidth({
  text,
  font,
}: {
  text: string;
  font: string;
}): number {
  return measureNaturalWidth(prepareWithSegments(text, font));
}

function getCenterTruncatedText({
  text,
  font,
  maxWidth,
}: {
  text: string;
  font: string;
  maxWidth: number;
}): string {
  if (maxWidth <= 0 || getPretextWidth({ text, font }) <= maxWidth) {
    return text;
  }

  const graphemes = Array.from(text);
  let minimumPrefixLength = Math.min(
    CENTER_TRUNCATION_PREFIX_LENGTH,
    Math.max(0, graphemes.length - 1)
  );
  let suffixLength = Math.min(
    CENTER_TRUNCATION_SUFFIX_LENGTH,
    Math.max(0, graphemes.length - minimumPrefixLength - 1)
  );
  const candidateFor = (prefixLength: number, tailLength = suffixLength) =>
    `${graphemes.slice(0, prefixLength).join("")}…${graphemes
      .slice(graphemes.length - tailLength)
      .join("")}`;

  if (
    getPretextWidth({ text: candidateFor(minimumPrefixLength, 0), font }) >
    maxWidth
  ) {
    suffixLength = 0;
    while (
      minimumPrefixLength > 0 &&
      getPretextWidth({
        text: candidateFor(minimumPrefixLength, 0),
        font,
      }) > maxWidth
    ) {
      minimumPrefixLength -= 1;
    }
  } else {
    while (
      suffixLength > 0 &&
      getPretextWidth({
        text: candidateFor(minimumPrefixLength),
        font,
      }) > maxWidth
    ) {
      suffixLength -= 1;
    }
  }

  let low = minimumPrefixLength;
  let high = Math.max(low, graphemes.length - suffixLength - 1);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (getPretextWidth({ text: candidateFor(middle), font }) <= maxWidth) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return candidateFor(low);
}

function getPretextAnnotationTextWidths(
  example: AnnotationValueExample
): AnnotationTextWidths {
  const nameWidth = Math.min(
    getPretextWidth({ text: example.name ?? "correctness", font: NAME_FONT }),
    MAX_TEXT_WIDTH
  );
  const labelWidth = example.label
    ? getPretextWidth({ text: example.label, font: VALUE_FONT })
    : 0;
  const scoreWidth =
    typeof example.score === "number"
      ? getPretextWidth({
          text: formatFloat(example.score),
          font: SCORE_FONT,
        })
      : 0;
  const hasLabelAndScore = labelWidth > 0 && scoreWidth > 0;
  const hasValue = labelWidth > 0 || scoreWidth > 0;
  const fallbackWidth = getPretextWidth({ text: "n/a", font: VALUE_FONT });
  const naturalValueWidth = hasValue
    ? labelWidth +
      scoreWidth +
      (hasLabelAndScore ? VALUE_DIVIDER_AND_GAPS_WIDTH : 0)
    : fallbackWidth;
  const valueWidth = Math.min(naturalValueWidth, MAX_TEXT_WIDTH);
  return {
    label: labelWidth,
    name: nameWidth,
    score: scoreWidth,
    value: valueWidth,
  };
}

function getPretextValuePreviewWidth(textWidths: AnnotationTextWidths): number {
  const labelPreviewWidth = Math.min(textWidths.label, MIN_LABEL_PREVIEW_WIDTH);
  if (textWidths.label > 0 && textWidths.score > 0) {
    return Math.min(
      textWidths.value,
      labelPreviewWidth + VALUE_DIVIDER_AND_GAPS_WIDTH + textWidths.score
    );
  }
  if (textWidths.label > 0) {
    return Math.min(textWidths.value, labelPreviewWidth);
  }
  if (textWidths.score > 0) {
    return Math.min(textWidths.value, textWidths.score);
  }
  return Math.min(textWidths.value, MIN_LABEL_PREVIEW_WIDTH);
}

function getPretextValueAllocationWidth({
  textWidth,
  textWidths,
}: {
  textWidth: number;
  textWidths: AnnotationTextWidths;
}): number {
  const minimumValueWidth = getPretextValuePreviewWidth(textWidths);
  const minimumNameWidth = Math.min(textWidths.name, MIN_NAME_PREVIEW_WIDTH);

  if (textWidth < minimumNameWidth + minimumValueWidth) {
    return 0;
  }

  const maximumValueWidth = textWidth - minimumNameWidth;

  if (textWidths.label > 0 && textWidths.score === 0) {
    return Math.min(
      textWidths.value,
      Math.max(minimumValueWidth, Math.min(textWidth / 2, maximumValueWidth))
    );
  }

  return Math.min(textWidths.value, minimumValueWidth, maximumValueWidth);
}

function getPretextAnnotationWidth(example: AnnotationValueExample): number {
  const textWidths = getPretextAnnotationTextWidths(example);
  return Math.min(
    Math.ceil(ANNOTATION_CHROME_WIDTH + textWidths.name + textWidths.value),
    INLINE_FLOW_CONTENT_WIDTH
  );
}

function packInlineFlowExamples({
  examples,
}: {
  examples: AnnotationValueExample[];
}): PackedInlineExample[] {
  let usedRowWidth = 0;

  return examples.map((example) => {
    const naturalWidth = getPretextAnnotationWidth(example);
    const gapWidth = usedRowWidth > 0 ? INLINE_FLOW_GAP : 0;
    const remainingWidth = INLINE_FLOW_CONTENT_WIDTH - usedRowWidth - gapWidth;

    if (naturalWidth <= remainingWidth) {
      usedRowWidth += gapWidth + naturalWidth;
      return { example, width: naturalWidth };
    }

    if (remainingWidth >= MIN_PACKED_ANNOTATION_WIDTH) {
      usedRowWidth = 0;
      return { example, width: remainingWidth };
    }

    usedRowWidth = naturalWidth;
    return { example, width: naturalWidth };
  });
}

const PRETEXT_PACKED_INLINE_FLOW_EXAMPLES = packInlineFlowExamples({
  examples: INLINE_FLOW_EXAMPLES,
});

const PRETEXT_TABLE_TEXT_WIDTHS = new Map(
  COMPARISON_EXAMPLES.map((example) => [
    example.id,
    getPretextAnnotationTextWidths(example),
  ])
);

const storyTableCSS = css`
  width: 100%;
  table-layout: fixed;

  th:nth-of-type(1),
  td:nth-of-type(1) {
    width: 10%;
  }

  th:nth-of-type(2),
  td:nth-of-type(2) {
    width: 25%;
  }

  th:nth-of-type(3),
  td:nth-of-type(3) {
    width: 40%;
  }

  th:nth-of-type(4),
  td:nth-of-type(4) {
    width: 25%;
  }

  td {
    vertical-align: top;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const comparisonTableCSS = css`
  width: 100%;
  table-layout: fixed;

  th:nth-of-type(1),
  td:nth-of-type(1) {
    width: 10%;
  }

  th:nth-of-type(2),
  td:nth-of-type(2) {
    width: 10%;
  }

  th:nth-of-type(3),
  td:nth-of-type(3) {
    width: 22%;
  }

  th:nth-of-type(4),
  td:nth-of-type(4) {
    width: 33%;
  }

  th:nth-of-type(5),
  td:nth-of-type(5) {
    width: 25%;
  }

  td {
    vertical-align: top;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const inlineFlowCSS = css`
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: var(--global-dimension-size-100);
  width: 600px;
  height: 200px;
  padding: var(--global-dimension-size-100);
  overflow: hidden;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
`;

const packedAnnotationCSS = (width: number) => css`
  flex: none;
  width: ${width}px;
`;

const pretextContentsCSS = ({
  chipWidth,
  nameWidth,
  valueWidth,
}: {
  chipWidth: number;
  nameWidth: number;
  valueWidth: number;
}) => css`
  width: ${chipWidth}px;
  .annotation-name-and-value > [title] {
    flex: none;
    width: ${nameWidth}px;
  }
  .annotation-name-and-value > [title] + div {
    flex: none;
    width: ${valueWidth}px;
  }
`;

function renderOptionalValue(value: string | number | null) {
  return value == null ? (
    <Text color="text-500">—</Text>
  ) : (
    <Text fontFamily={typeof value === "number" ? "mono" : "default"}>
      {value}
    </Text>
  );
}

function PretextSizedAnnotationLabel({
  example,
}: {
  example: AnnotationValueExample;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions(containerRef);
  const textWidths = PRETEXT_TABLE_TEXT_WIDTHS.get(example.id) ?? {
    label: 0,
    name: 0,
    score: 0,
    value: 0,
  };
  const naturalChipWidth =
    ANNOTATION_CHROME_WIDTH + textWidths.name + textWidths.value;
  const chipWidth = Math.min(
    naturalChipWidth,
    dimensions?.width ?? naturalChipWidth
  );
  const textWidth = Math.max(0, chipWidth - ANNOTATION_CHROME_WIDTH);
  const reservedValueWidth = getPretextValueAllocationWidth({
    textWidth,
    textWidths,
  });
  const nameWidth = Math.min(textWidths.name, textWidth - reservedValueWidth);
  const valueWidth = Math.min(textWidths.value, textWidth - nameWidth);
  const labelWidth = Math.max(
    0,
    valueWidth -
      (textWidths.score > 0
        ? textWidths.score + VALUE_DIVIDER_AND_GAPS_WIDTH
        : 0)
  );
  const displayName = getCenterTruncatedText({
    text: example.name ?? "correctness",
    font: NAME_FONT,
    maxWidth: nameWidth,
  });
  const displayLabel = example.label
    ? getCenterTruncatedText({
        text: example.label,
        font: VALUE_FONT,
        maxWidth: labelWidth,
      })
    : example.label;

  return (
    <div ref={containerRef} css={css({ width: "100%" })}>
      <AnnotationLabel
        annotationDisplayPreference="score-and-label"
        annotation={{
          id: example.id,
          name: displayName,
          score: example.score,
          label: displayLabel,
          explanation: example.explanation,
        }}
        css={pretextContentsCSS({ chipWidth, nameWidth, valueWidth })}
      />
    </div>
  );
}

function AnnotationComparisonRow({
  example,
  layout,
}: {
  example: AnnotationValueExample;
  layout: "Native" | "Pretext";
}) {
  return (
    <tr>
      <td>
        <Text size="XS" color="text-500">
          {layout}
        </Text>
      </td>
      <td>{renderOptionalValue(example.score)}</td>
      <td>{renderOptionalValue(example.label)}</td>
      <td>{renderOptionalValue(example.explanation)}</td>
      <td>
        {layout === "Pretext" ? (
          <PretextSizedAnnotationLabel example={example} />
        ) : (
          <AnnotationLabel
            annotationDisplayPreference="score-and-label"
            annotation={{
              id: example.id,
              name: example.name ?? "correctness",
              score: example.score,
              label: example.label,
              explanation: example.explanation,
            }}
          />
        )}
      </td>
    </tr>
  );
}

function AnnotationLabelValueTable() {
  return (
    <Flex direction="column" gap="size-200" alignItems="start">
      <View
        borderColor="default"
        borderWidth="thin"
        borderRadius="medium"
        width="100%"
      >
        <table css={css(tableCSS, borderedTableCSS, storyTableCSS)}>
          <thead>
            <tr>
              <th scope="col">Score</th>
              <th scope="col">Label</th>
              <th scope="col">Explanation</th>
              <th scope="col">Annotation label</th>
            </tr>
          </thead>
          <tbody>
            {VALUE_EXAMPLES.map((example) => (
              <tr key={example.id}>
                <td>{renderOptionalValue(example.score)}</td>
                <td>{renderOptionalValue(example.label)}</td>
                <td>{renderOptionalValue(example.explanation)}</td>
                <td>
                  <AnnotationLabel
                    annotationDisplayPreference="score-and-label"
                    annotation={{
                      id: example.id,
                      name: example.name ?? "correctness",
                      score: example.score,
                      label: example.label,
                      explanation: example.explanation,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </View>
      <Text size="XS" color="text-500">
        Native / Pretext row comparison
      </Text>
      <View
        borderColor="default"
        borderWidth="thin"
        borderRadius="medium"
        width="100%"
      >
        <table css={css(tableCSS, borderedTableCSS, comparisonTableCSS)}>
          <thead>
            <tr>
              <th scope="col">Layout</th>
              <th scope="col">Score</th>
              <th scope="col">Label</th>
              <th scope="col">Explanation</th>
              <th scope="col">Annotation label</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_EXAMPLES.flatMap((example) =>
              (["Native", "Pretext"] as const).map((layout) => (
                <AnnotationComparisonRow
                  key={`${example.id}-${layout}`}
                  example={example}
                  layout={layout}
                />
              ))
            )}
          </tbody>
        </table>
      </View>
      <Text size="XS" color="text-500">
        Pretext-packed widths
      </Text>
      <div css={inlineFlowCSS} aria-label="Pretext-packed annotation flow">
        {PRETEXT_PACKED_INLINE_FLOW_EXAMPLES.map(({ example, width }) => (
          <AnnotationLabel
            key={example.id}
            annotationDisplayPreference="score-and-label"
            annotation={{
              id: example.id,
              name: example.name ?? "correctness",
              score: example.score,
              label: example.label,
              explanation: example.explanation,
            }}
            css={packedAnnotationCSS(width)}
          />
        ))}
      </div>
      <Text size="XS" color="text-500">
        Native flex wrapping
      </Text>
      <div css={inlineFlowCSS} aria-label="Native annotation flow">
        {INLINE_FLOW_EXAMPLES.map(
          ({ id, name = "correctness", score, label, explanation }) => (
            <AnnotationLabel
              key={id}
              annotationDisplayPreference="score-and-label"
              annotation={{ id, name, score, label, explanation }}
            />
          )
        )}
      </div>
    </Flex>
  );
}

const meta = {
  title: "Detail panel/Annotation label",
  component: AnnotationLabel,
  parameters: {
    inset: false,
    width: "fill",
    docs: {
      description: {
        component:
          "Score, label, and explanation presence permutations using the score-and-label display preference, followed by paired native and Pretext rows for each glyph-width example. The first 600 × 200 region uses Pretext measurements to truncate labels into usable row remainders; the second is the same data with native flex wrapping.",
      },
    },
  },
} satisfies Meta<typeof AnnotationLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ValuePermutations: Story = {
  args: {
    annotation: {
      name: "correctness",
    },
  },
  render: () => <AnnotationLabelValueTable />,
  tags: ["!dev"],
};

export const Ghost: Story = {
  args: {
    annotation: { name: "confidence" },
    annotationDisplayPreference: "none",
    clickable: true,
    variant: "ghost",
  },
};
