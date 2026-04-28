import type {
  ClassificationEvaluatorAnnotationConfig,
  CodeEvaluatorLanguage,
  ContinuousEvaluatorAnnotationConfig,
} from "@phoenix/types";

export type EvaluatorOutputShape = "categorical" | "continuous";

type OutputConfig =
  | ClassificationEvaluatorAnnotationConfig
  | ContinuousEvaluatorAnnotationConfig;

/**
 * Returns hardcoded two-shape templates (bare return + dict-form comment) with
 * static fallback values ("pass" for categorical, 0.5 for continuous).
 */
export function getStaticFallbackSource(
  language: CodeEvaluatorLanguage,
  shape: EvaluatorOutputShape
): string {
  if (language === "PYTHON") {
    if (shape === "categorical") {
      return `def evaluate(output, reference=None, input=None, metadata=None):
    # return {"label": "pass", "score": 1, "explanation": "..."}  # also set score and explanation
    return "pass"  # label only
`;
    }
    // continuous
    return `def evaluate(output, reference=None, input=None, metadata=None):
    # return {"score": 0.5, "explanation": "..."}  # also set explanation
    return 0.5  # score only
`;
  }
  // TYPESCRIPT
  if (shape === "categorical") {
    return `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
  // return { label: "pass", score: 1, explanation: "..." };  // also set score and explanation
  return "pass";  // label only
}
`;
  }
  // continuous
  return `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
  // return { score: 0.5, explanation: "..." };  // also set explanation
  return 0.5;  // score only
}
`;
}

/**
 * Returns a config-aware two-shape template. Substitutes the first label
 * (categorical) or the midpoint of bounds (continuous) into the template.
 * Falls back to getStaticFallbackSource on any error or incomplete config and
 * emits a structured console.warn describing the reason.
 */
export function getDefaultCodeEvaluatorSource(
  language: CodeEvaluatorLanguage,
  shape: EvaluatorOutputShape,
  config?: OutputConfig
): string {
  try {
    if (!config) {
      // eslint-disable-next-line no-console
      console.warn({
        component: "getDefaultCodeEvaluatorSource",
        shape,
        language,
        reason: "missing_config",
      });
      return getStaticFallbackSource(language, shape);
    }

    if (shape === "categorical") {
      const catConfig = config as ClassificationEvaluatorAnnotationConfig;
      if (!catConfig.values || catConfig.values.length === 0) {
        // eslint-disable-next-line no-console
        console.warn({
          component: "getDefaultCodeEvaluatorSource",
          shape,
          language,
          reason: "empty_values",
        });
        return getStaticFallbackSource(language, shape);
      }
      const label = catConfig.values[0].label;
      if (language === "PYTHON") {
        return `def evaluate(output, reference=None, input=None, metadata=None):
    # return {"label": "${label}", "score": 1, "explanation": "..."}  # also set score and explanation
    return "${label}"  # label only
`;
      }
      // TYPESCRIPT
      return `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
  // return { label: "${label}", score: 1, explanation: "..." };  // also set score and explanation
  return "${label}";  // label only
}
`;
    }

    if (shape === "continuous") {
      const contConfig = config as ContinuousEvaluatorAnnotationConfig;
      const lower = contConfig.lowerBound;
      const upper = contConfig.upperBound;
      if (lower == null || upper == null) {
        // eslint-disable-next-line no-console
        console.warn({
          component: "getDefaultCodeEvaluatorSource",
          shape,
          language,
          reason: "missing_bounds",
        });
        return getStaticFallbackSource(language, shape);
      }
      const midpoint = (lower + upper) / 2;
      const rangeComment = `${lower.toFixed(1)} - ${upper.toFixed(1)}`;
      if (language === "PYTHON") {
        return `def evaluate(output, reference=None, input=None, metadata=None):
    # return {"score": ${midpoint.toFixed(1)}, "explanation": "..."}  # also set explanation
    return ${midpoint.toFixed(1)}  # score only (expected range: ${rangeComment})
`;
      }
      // TYPESCRIPT
      return `function evaluate({ output, reference, input, metadata }: EvaluatorParams) {
  // return { score: ${midpoint.toFixed(1)}, explanation: "..." };  // also set explanation
  return ${midpoint.toFixed(1)};  // score only (expected range: ${rangeComment})
}
`;
    }

    // unexpected shape
    // eslint-disable-next-line no-console
    console.warn({
      component: "getDefaultCodeEvaluatorSource",
      shape,
      language,
      reason: "unexpected_shape",
    });
    return getStaticFallbackSource(language, shape);
  } catch {
    // eslint-disable-next-line no-console
    console.warn({
      component: "getDefaultCodeEvaluatorSource",
      shape,
      language,
      reason: "substitution_threw",
    });
    return getStaticFallbackSource(language, shape);
  }
}

/**
 * Returns all possible generated source strings for a given language across
 * both shapes, including both substituted and static-fallback variants for
 * any config. Used by guards to detect whether the current editor content
 * is a generated default (vs. user-edited).
 */
export function getAllGeneratedSources(
  language: CodeEvaluatorLanguage,
  config?: OutputConfig
): string[] {
  const shapes: EvaluatorOutputShape[] = ["categorical", "continuous"];
  const sources: string[] = [];
  for (const shape of shapes) {
    sources.push(getStaticFallbackSource(language, shape));
    sources.push(getDefaultCodeEvaluatorSource(language, shape, config));
  }
  return [...new Set(sources)];
}

export const DEFAULT_CODE_EVALUATOR_SOURCE: Record<
  CodeEvaluatorLanguage,
  string
> = {
  PYTHON: getStaticFallbackSource("PYTHON", "continuous"),
  TYPESCRIPT: getStaticFallbackSource("TYPESCRIPT", "continuous"),
};

export const extractCodeEvaluatorVariables = ({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}) => {
  if (language === "PYTHON") {
    return extractPythonVariables(sourceCode);
  }
  return extractTypeScriptVariables(sourceCode);
};

function extractPythonVariables(sourceCode: string) {
  const match = sourceCode.match(/def\s+evaluate\s*\(([^)]*)\)/);
  if (!match) {
    return [];
  }
  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^\*+/, ""))
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .map((part) => part.split(":")[0]?.trim() ?? "")
    .filter(Boolean)
    .filter((part) => part !== "/")
    .filter(unique);
}

function extractTypeScriptVariables(sourceCode: string) {
  const signature =
    sourceCode.match(/function\s+evaluate\s*\(([^)]*)\)/) ??
    sourceCode.match(/(?:const|let|var)\s+evaluate\s*=\s*\(([^)]*)\)\s*=>/);
  if (!signature) {
    return [];
  }
  const params = signature[1]?.trim() ?? "";
  if (!params) {
    return [];
  }
  const destructured = params.match(/^\{([^}]*)\}/);
  if (destructured) {
    return destructured[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(":")[0]?.trim() ?? "")
      .map((part) => part.split("=")[0]?.trim() ?? "")
      .map((part) => part.replace(/\?$/, "").trim())
      .filter(Boolean)
      .filter(unique);
  }
  return [];
}

function unique(value: string, index: number, values: string[]) {
  return values.indexOf(value) === index;
}
