import type {
  ClassificationEvaluatorAnnotationConfig,
  CodeEvaluatorLanguage,
} from "@phoenix/types";

/** A template's annotation config, minus the name (set from the evaluator). */
type TemplateOutputConfig = Omit<
  ClassificationEvaluatorAnnotationConfig,
  "name"
>;

/**
 * A pre-defined code evaluator snippet. The same idea as the built-in
 * evaluators (exact match, contains, regex, levenshtein distance, json
 * distance) but expressed as editable source code for code evaluators.
 *
 * Each template returns a `{ label, score, explanation }` result and ships a
 * matching annotation (output) config so the labels it emits are valid as
 * soon as the template is applied.
 *
 * Templates are language-aware: {@link CodeEvaluatorTemplate.getSource}
 * returns the appropriate Python or TypeScript implementation.
 */
export type CodeEvaluatorTemplate = {
  id: string;
  name: string;
  description: string;
  getSource: (language: CodeEvaluatorLanguage) => string;
  /** Annotation (output) config matching the labels this template emits. */
  outputConfig: TemplateOutputConfig;
};

/**
 * Builds a categorical config from a `{ label: score }` map — the shape every
 * template below emits.
 */
const getCategoricalConfigFromChoices = (
  choices: Record<string, number>
): TemplateOutputConfig => ({
  optimizationDirection: "NONE",
  values: Object.entries(choices).map(([label, score]) => ({ label, score })),
});

const PYTHON_SOURCES: Record<string, string> = {
  exact_match: `def evaluate(output, reference=None, input=None, metadata=None):
    matched = str(output).strip() == str(reference).strip()
    return {
        "label": "match" if matched else "mismatch",
        "score": 1.0 if matched else 0.0,
        "explanation": (
            "Output matches the reference."
            if matched
            else "Output does not match the reference."
        ),
    }
`,
  contains: `def evaluate(output, reference=None, input=None, metadata=None):
    contained = str(reference) in str(output)
    return {
        "label": "contains" if contained else "missing",
        "score": 1.0 if contained else 0.0,
        "explanation": (
            "Output contains the reference text."
            if contained
            else "Output does not contain the reference text."
        ),
    }
`,
  regex: `import re

def evaluate(output, reference=None, input=None, metadata=None):
    pattern = r"^[0-9]+$"
    matched = re.search(pattern, str(output)) is not None
    return {
        "label": "match" if matched else "no_match",
        "score": 1.0 if matched else 0.0,
        "explanation": f"Output {'matches' if matched else 'does not match'} pattern {pattern!r}.",
    }
`,
  levenshtein_distance: `def evaluate(output, reference=None, input=None, metadata=None):
    a, b = str(output), str(reference)
    if not a and not b:
        similarity = 1.0
    else:
        rows, cols = len(a) + 1, len(b) + 1
        dist = [[0] * cols for _ in range(rows)]
        for i in range(rows):
            dist[i][0] = i
        for j in range(cols):
            dist[0][j] = j
        for i in range(1, rows):
            for j in range(1, cols):
                cost = 0 if a[i - 1] == b[j - 1] else 1
                dist[i][j] = min(
                    dist[i - 1][j] + 1,
                    dist[i][j - 1] + 1,
                    dist[i - 1][j - 1] + cost,
                )
        similarity = 1.0 - dist[rows - 1][cols - 1] / max(len(a), len(b))
    return {
        "label": "similar" if similarity >= 0.5 else "different",
        "score": similarity,
        "explanation": f"Normalized Levenshtein similarity is {similarity:.2f}.",
    }
`,
  json_distance: `import json

def evaluate(output, reference=None, input=None, metadata=None):
    def _parse(value):
        return json.loads(value) if isinstance(value, str) else value
    try:
        equal = _parse(output) == _parse(reference)
    except (ValueError, TypeError):
        equal = False
    return {
        "label": "equal" if equal else "not_equal",
        "score": 1.0 if equal else 0.0,
        "explanation": (
            "Parsed JSON values are equal."
            if equal
            else "Parsed JSON values differ."
        ),
    }
`,
};

const TYPESCRIPT_SOURCES: Record<string, string> = {
  exact_match: `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
  const matched = String(output).trim() === String(reference).trim();
  return {
    label: matched ? "match" : "mismatch",
    score: matched ? 1 : 0,
    explanation: matched
      ? "Output matches the reference."
      : "Output does not match the reference.",
  };
}
`,
  contains: `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
  const contained = String(output).includes(String(reference));
  return {
    label: contained ? "contains" : "missing",
    score: contained ? 1 : 0,
    explanation: contained
      ? "Output contains the reference text."
      : "Output does not contain the reference text.",
  };
}
`,
  regex: `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
  const pattern = /^[0-9]+$/;
  const matched = pattern.test(String(output));
  return {
    label: matched ? "match" : "no_match",
    score: matched ? 1 : 0,
    explanation: \`Output \${matched ? "matches" : "does not match"} pattern \${pattern}.\`,
  };
}
`,
  levenshtein_distance: `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
  const a = String(output);
  const b = String(reference);
  let similarity: number;
  if (!a && !b) {
    similarity = 1;
  } else {
    const dist: number[][] = Array.from({ length: a.length + 1 }, () =>
      new Array<number>(b.length + 1).fill(0)
    );
    for (let i = 0; i <= a.length; i++) dist[i][0] = i;
    for (let j = 0; j <= b.length; j++) dist[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dist[i][j] = Math.min(
          dist[i - 1][j] + 1,
          dist[i][j - 1] + 1,
          dist[i - 1][j - 1] + cost
        );
      }
    }
    similarity = 1 - dist[a.length][b.length] / Math.max(a.length, b.length);
  }
  return {
    label: similarity >= 0.5 ? "similar" : "different",
    score: similarity,
    explanation: \`Normalized Levenshtein similarity is \${similarity.toFixed(2)}.\`,
  };
}
`,
  json_distance: `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
  const parse = (value: unknown) =>
    typeof value === "string" ? JSON.parse(value) : value;
  let equal: boolean;
  try {
    equal = JSON.stringify(parse(output)) === JSON.stringify(parse(reference));
  } catch {
    equal = false;
  }
  return {
    label: equal ? "equal" : "not_equal",
    score: equal ? 1 : 0,
    explanation: equal
      ? "Parsed JSON values are equal."
      : "Parsed JSON values differ.",
  };
}
`,
};

const makeTemplate = (
  id: string,
  name: string,
  description: string,
  outputConfig: TemplateOutputConfig
): CodeEvaluatorTemplate => ({
  id,
  name,
  description,
  getSource: (language) =>
    language === "PYTHON" ? PYTHON_SOURCES[id] : TYPESCRIPT_SOURCES[id],
  outputConfig,
});

export const CODE_EVALUATOR_TEMPLATES: readonly CodeEvaluatorTemplate[] = [
  makeTemplate(
    "exact_match",
    "Exact match",
    "Match/mismatch when the output equals the reference.",
    getCategoricalConfigFromChoices({ match: 1, mismatch: 0 })
  ),
  makeTemplate(
    "contains",
    "Contains",
    "Whether the output contains the reference text.",
    getCategoricalConfigFromChoices({ contains: 1, missing: 0 })
  ),
  makeTemplate(
    "regex",
    "Regex",
    "Whether the output matches a regular expression.",
    getCategoricalConfigFromChoices({ match: 1, no_match: 0 })
  ),
  makeTemplate(
    "levenshtein_distance",
    "Levenshtein distance",
    "Normalized edit-distance similarity between output and reference.",
    getCategoricalConfigFromChoices({ similar: 1, different: 0 })
  ),
  makeTemplate(
    "json_distance",
    "JSON distance",
    "Whether the output and reference are equal parsed as JSON.",
    getCategoricalConfigFromChoices({ equal: 1, not_equal: 0 })
  ),
];
