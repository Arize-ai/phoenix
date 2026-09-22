/**
 * @generated SignedSource<<389893d4204e98ec5df06f4edc9a1757>>
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
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareMatrix_evaluator" | "ProjectEvaluatorCompareStats_evaluator" | "ProjectEvaluatorCompareTargets_evaluator">;
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
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ProjectEvaluatorCompareTargets_evaluator"
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "aa005d8f0baa0b05c0164525eccf03dc";

export default node;
