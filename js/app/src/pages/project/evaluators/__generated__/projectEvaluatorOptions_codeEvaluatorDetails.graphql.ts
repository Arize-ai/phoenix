/**
 * @generated SignedSource<<7cc54066238328e00ed8a7f761135a8e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type projectEvaluatorOptions_codeEvaluatorDetails$data = {
  readonly __typename: "CodeEvaluator";
  readonly description: string | null;
  readonly id: string;
  readonly kind: EvaluatorKind;
  readonly language: Language;
  readonly name: string;
  readonly outputConfigs: ReadonlyArray<{
    readonly __typename: "CategoricalAnnotationConfig";
    readonly name: string;
    readonly optimizationDirection: OptimizationDirection;
    readonly values: ReadonlyArray<{
      readonly label: string;
      readonly score: number | null;
    }>;
  } | {
    readonly __typename: "ContinuousAnnotationConfig";
    readonly lowerBound: number | null;
    readonly name: string;
    readonly optimizationDirection: OptimizationDirection;
    readonly upperBound: number | null;
  } | {
    readonly __typename: "FreeformAnnotationConfig";
    readonly lowerBound: number | null;
    readonly name: string;
    readonly optimizationDirection: OptimizationDirection;
    readonly threshold: number | null;
    readonly upperBound: number | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  }>;
  readonly sourceCode: string;
  readonly " $fragmentType": "projectEvaluatorOptions_codeEvaluatorDetails";
};
export type projectEvaluatorOptions_codeEvaluatorDetails$key = {
  readonly " $data"?: projectEvaluatorOptions_codeEvaluatorDetails$data;
  readonly " $fragmentSpreads": FragmentRefs<"projectEvaluatorOptions_codeEvaluatorDetails">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "projectEvaluatorOptions_codeEvaluatorDetails"
};

(node as any).hash = "9335d602204b26f5e830ed106d937640";

export default node;
