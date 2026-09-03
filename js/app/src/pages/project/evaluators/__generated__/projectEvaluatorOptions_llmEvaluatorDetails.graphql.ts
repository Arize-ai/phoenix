/**
 * @generated SignedSource<<e84bae7f26625170d5a6fe7d1e03f8f0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type projectEvaluatorOptions_llmEvaluatorDetails$data = {
  readonly __typename: "LLMEvaluator";
  readonly description: string | null;
  readonly id: string;
  readonly kind: EvaluatorKind;
  readonly llmInputSchema: any;
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
  readonly promptVersion: {
    readonly template: {
      readonly __typename: "PromptChatTemplate";
      readonly messages: ReadonlyArray<{
        readonly " $fragmentSpreads": FragmentRefs<"promptUtils_promptMessages">;
      }>;
    } | {
      readonly __typename: "PromptStringTemplate";
      readonly template: string;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    };
    readonly templateFormat: PromptTemplateFormat;
    readonly tools: {
      readonly tools: ReadonlyArray<{
        readonly __typename: "PromptToolFunction";
        readonly function: {
          readonly parameters: any;
        };
      } | {
        readonly __typename: "PromptToolRaw";
        readonly raw: any;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
    } | null;
  };
  readonly " $fragmentType": "projectEvaluatorOptions_llmEvaluatorDetails";
};
export type projectEvaluatorOptions_llmEvaluatorDetails$key = {
  readonly " $data"?: projectEvaluatorOptions_llmEvaluatorDetails$data;
  readonly " $fragmentSpreads": FragmentRefs<"projectEvaluatorOptions_llmEvaluatorDetails">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "projectEvaluatorOptions_llmEvaluatorDetails"
};

(node as any).hash = "e9490d681bf7fe3a06f782c3715dbef0";

export default node;
