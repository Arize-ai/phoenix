/**
 * @generated SignedSource<<4ec1834e6c3108ec2f75d5ff1f8bb021>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareContent_evaluator$data = {
  readonly id: string;
  readonly name: string;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareMatrix_evaluator" | "ProjectEvaluatorCompareStats_evaluator">;
  readonly " $fragmentType": "ProjectEvaluatorCompareContent_evaluator";
};
export type ProjectEvaluatorCompareContent_evaluator$key = {
  readonly " $data"?: ProjectEvaluatorCompareContent_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareContent_evaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCompareContent_evaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ProjectEvaluatorCompareStats_evaluator"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ProjectEvaluatorCompareMatrix_evaluator"
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "177698f60d1cf14fd060ce3b82469e9f";

export default node;
