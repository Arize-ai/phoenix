/**
 * @generated SignedSource<<352eac774590618a1ceeceb91c586828>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLatestVersionsList_decision$data = {
  readonly id: string;
  readonly latestVersions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly sequenceNumber: number;
        readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionSummary_version">;
      };
    }>;
  };
  readonly " $fragmentType": "DecisionLatestVersionsList_decision";
};
export type DecisionLatestVersionsList_decision$key = {
  readonly " $data"?: DecisionLatestVersionsList_decision$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLatestVersionsList_decision">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionLatestVersionsList_decision",
  "selections": [
    (v0/*:: as any*/),
    {
      "alias": "latestVersions",
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 5
        }
      ],
      "concreteType": "DecisionVersionConnection",
      "kind": "LinkedField",
      "name": "versions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionVersionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionVersion",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v0/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "sequenceNumber",
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "DecisionVersionSummary_version"
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "versions(first:5)"
    }
  ],
  "type": "Decision",
  "abstractKey": null
};
})();

(node as any).hash = "d7abd646d2c6bb3befa64f779a79f460";

export default node;
