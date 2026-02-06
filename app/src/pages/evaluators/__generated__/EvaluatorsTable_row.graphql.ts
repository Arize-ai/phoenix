/**
 * @generated SignedSource<<5e9a6ef514334defaf291a1270683dea>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type EvaluatorsTable_row$data = {
  readonly createdAt: string;
  readonly datasetEvaluators: ReadonlyArray<{
    readonly dataset: {
      readonly id: string;
      readonly name: string;
    };
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
    readonly updatedAt: string;
    readonly user: {
      readonly profilePictureUrl: string | null;
      readonly username: string;
    } | null;
  }>;
  readonly datasets: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly description: string | null;
  readonly id: string;
  readonly kind: EvaluatorKind;
  readonly name: string;
  readonly prompt?: {
    readonly id: string;
    readonly name: string;
  };
  readonly promptVersionTag?: {
    readonly name: string;
  } | null;
  readonly updatedAt: string;
  readonly user?: {
    readonly profilePictureUrl: string | null;
    readonly username: string;
  } | null;
  readonly " $fragmentType": "EvaluatorsTable_row";
};
export type EvaluatorsTable_row$key = {
  readonly " $data"?: EvaluatorsTable_row$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorsTable_row">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "EvaluatorsTable_row"
};

(node as any).hash = "aef72040c8ad447ffde5d09cb3a2a642";

export default node;
