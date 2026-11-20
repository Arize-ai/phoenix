import { formatTemplate } from "../template";
import type {
  ClassificationChoicesMap,
  ClassificationCriterion,
  CreateClassifierArgs,
  Criterion,
  CriterionResult,
  EvaluationResult,
  EvaluatorFn,
} from "../types/evals";
import { isCriteriaList } from "../utils/isCriteriaList";
import { generateClassification } from "./generateClassification";
import { generateClassifications } from "./generateClassifications";

/**
 * A function that classifies one example against multiple criteria, returning
 * one result per criterion.
 */
export type CriteriaEvaluatorFn<ExampleType extends Record<string, unknown>> = (
  example: ExampleType
) => Promise<CriterionResult[]>;

/**
 * Convert a mapping of choices to labels
 * Asserts that the choices are valid
 */
function choicesToLabels(
  choices: ClassificationChoicesMap
): [string, ...string[]] {
  const labels = Object.keys(choices);
  if (labels.length < 1) {
    throw new Error("No choices provided");
  }
  return labels as [string, ...string[]];
}

/**
 * Validate a user-supplied list of criteria and convert each into the
 * backend-level {@link ClassificationCriterion}. Throws when a criterion has an
 * empty name or instruction, defines no choices, or when names are not unique.
 */
function toClassificationCriteria(
  criteria: Criterion[]
): [ClassificationCriterion, ...ClassificationCriterion[]] {
  if (criteria.length < 1) {
    throw new Error("At least one criterion must be provided.");
  }
  const seenNames = new Set<string>();
  const classificationCriteria = criteria.map((criterion) => {
    if (!criterion.name) {
      throw new Error("Each criterion must have a non-empty name.");
    }
    if (!criterion.instruction) {
      throw new Error(
        `Criterion '${criterion.name}' must have a non-empty instruction; it becomes the question asked about this criterion.`
      );
    }
    if (seenNames.has(criterion.name)) {
      throw new Error(
        `Criterion names must be unique; duplicated: '${criterion.name}'. Each criterion's name keys its question and resulting result.`
      );
    }
    seenNames.add(criterion.name);
    return {
      name: criterion.name,
      labels: choicesToLabels(criterion.choices),
      instruction: criterion.instruction,
    };
  });
  return classificationCriteria as [
    ClassificationCriterion,
    ...ClassificationCriterion[],
  ];
}

/**
 * A function that serves as a factory that will output a classification evaluator function
 */
export function createClassifierFn<
  RecordToEvaluate extends Record<string, unknown>,
>(args: CreateClassifierArgs): EvaluatorFn<RecordToEvaluate> {
  const { model, choices, promptTemplate, ...rest } = args;

  if (isCriteriaList(choices)) {
    throw new Error(
      "createClassifierFn requires a label-to-score choices map; use createCriteriaClassifierFn for a list of criteria."
    );
  }

  return async (args: RecordToEvaluate): Promise<EvaluationResult> => {
    const templateVariables = {
      ...args,
    };

    const prompt = formatTemplate({
      template: promptTemplate,
      variables: templateVariables,
    });

    const classification = await generateClassification({
      model,
      labels: choicesToLabels(choices),
      prompt,
      ...rest,
    });

    // Post-process the classification result and map it to the choices
    const score = choices[classification.label];

    return {
      score,
      ...classification,
    };
  };
}

/**
 * A factory that outputs a multi-criterion classification evaluator function.
 * Each criterion produces one {@link CriterionResult}; the returned function
 * answers them all in a single backend request.
 */
export function createCriteriaClassifierFn<
  RecordToEvaluate extends Record<string, unknown>,
>(args: CreateClassifierArgs): CriteriaEvaluatorFn<RecordToEvaluate> {
  const { model, choices, promptTemplate, ...rest } = args;

  if (!isCriteriaList(choices)) {
    throw new Error(
      "createCriteriaClassifierFn requires a list of criteria; use createClassifierFn for a label-to-score map."
    );
  }

  const criteria = choices;
  const classificationCriteria = toClassificationCriteria(criteria);
  const criteriaByName = new Map(
    criteria.map((criterion) => [criterion.name, criterion])
  );

  return async (example: RecordToEvaluate): Promise<CriterionResult[]> => {
    const prompt = formatTemplate({
      template: promptTemplate,
      variables: { ...example },
    });

    const results = await generateClassifications({
      model,
      criteria: classificationCriteria,
      prompt,
      ...rest,
    });

    return results.map((result) => {
      const criterion = criteriaByName.get(result.name);
      if (!criterion) {
        throw new Error(
          `Received a result for unknown criterion '${result.name}'.`
        );
      }
      const score = criterion.choices[result.label];
      if (score === undefined) {
        throw new Error(
          `Criterion '${criterion.name}' received invalid label '${result.label}'. Valid labels are: ${Object.keys(criterion.choices).join(", ")}.`
        );
      }
      return {
        name: result.name,
        score,
        label: result.label,
        explanation: result.explanation,
        metadata: result.metadata,
      };
    });
  };
}
