/**
 * @generated SignedSource<<a51dc0fec8c4ea1ddef437fd91e7000c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareDistributions_side$data = {
  readonly evaluatedCount: number;
  readonly labelCounts: ReadonlyArray<{
    readonly count: number;
    readonly isOther: boolean;
    readonly label: string;
    readonly score: number | null;
  }> | null;
  readonly meanScore: number | null;
  readonly scoreBinCounts: ReadonlyArray<number> | null;
  readonly scoreBinEdges: ReadonlyArray<number> | null;
  readonly scoreValueCounts: ReadonlyArray<{
    readonly count: number;
    readonly score: number;
  }> | null;
  readonly threshold: number | null;
  readonly " $fragmentType": "ProjectEvaluatorCompareDistributions_side";
};
export type ProjectEvaluatorCompareDistributions_side$key = {
  readonly " $data"?: ProjectEvaluatorCompareDistributions_side$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareDistributions_side">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorCompareDistributions_side",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluatedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "meanScore",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "scoreBinEdges",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "scoreBinCounts",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorScoreValueCount",
      "kind": "LinkedField",
      "name": "scoreValueCounts",
      "plural": true,
      "selections": [
        (v0/*:: as any*/),
        (v1/*:: as any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorLabelCount",
      "kind": "LinkedField",
      "name": "labelCounts",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "label",
          "storageKey": null
        },
        (v0/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "isOther",
          "storageKey": null
        },
        (v1/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "EvaluatorDistribution",
  "abstractKey": null
};
})();

(node as any).hash = "d18f42f1da25130b348630ba22094afa";

export default node;
