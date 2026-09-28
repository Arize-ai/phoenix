/**
 * @generated SignedSource<<81d1c529baad46ff91f8f7314e9afd55>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareStats_evaluator$data = {
  readonly name: string;
  readonly " $fragmentType": "ProjectEvaluatorCompareStats_evaluator";
};
export type ProjectEvaluatorCompareStats_evaluator$key = {
  readonly " $data"?: ProjectEvaluatorCompareStats_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareStats_evaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCompareStats_evaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "2fe09e784a5e9fa8c9d7b91d98795df6";

export default node;
