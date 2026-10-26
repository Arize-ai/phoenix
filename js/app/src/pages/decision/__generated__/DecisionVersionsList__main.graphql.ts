/**
 * @generated SignedSource<<1ae7608df95902eed9ad718b07bd8193>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionVersionsList__main$data = {
  readonly versions: {
    readonly edges: ReadonlyArray<{
      readonly version: {
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionSummaryFragment">;
      };
    }>;
  };
  readonly " $fragmentType": "DecisionVersionsList__main";
};
export type DecisionVersionsList__main$key = {
  readonly " $data"?: DecisionVersionsList__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionsList__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionVersionsList__main",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 100
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
              "alias": "version",
              "args": null,
              "concreteType": "DecisionVersion",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "id",
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "DecisionVersionSummaryFragment"
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "versions(first:100)"
    }
  ],
  "type": "Decision",
  "abstractKey": null
};

(node as any).hash = "b71438ce79a01ec0949725f92ff407e4";

export default node;
