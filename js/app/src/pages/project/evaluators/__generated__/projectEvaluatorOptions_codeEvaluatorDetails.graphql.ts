/**
 * @generated SignedSource<<2cb4782a5faedfe514bbda02a650856e>>
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
  readonly codeInputSchema: any | null;
  readonly description: string | null;
  readonly id: string;
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
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
  readonly sandboxConfig: {
    readonly id: string;
  } | null;
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

(node as any).hash = "f8acbca29ae9f38b9b1b91246145910b";

export default node;
