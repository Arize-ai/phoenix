/**
 * @generated SignedSource<<8d5bd572b96e87acd09d3543c0377495>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorAdvancedDetails_projectEvaluator$data = {
  readonly tracingEnabled: boolean;
  readonly " $fragmentType": "ProjectEvaluatorAdvancedDetails_projectEvaluator";
};
export type ProjectEvaluatorAdvancedDetails_projectEvaluator$key = {
  readonly " $data"?: ProjectEvaluatorAdvancedDetails_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorAdvancedDetails_projectEvaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorAdvancedDetails_projectEvaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tracingEnabled",
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "e88eb6ac3b302426bd36ae06e5f58bbc";

export default node;
