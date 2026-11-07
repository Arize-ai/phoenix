/**
 * @generated SignedSource<<8be89059e23ad4d9cccaaeb85d7c5182>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLabelConfigButton_allLabels$data = {
  readonly decisionLabels: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly " $fragmentType": "DecisionLabelConfigButton_allLabels";
};
export type DecisionLabelConfigButton_allLabels$key = {
  readonly " $data"?: DecisionLabelConfigButton_allLabels$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelConfigButton_allLabels">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": 100,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": null,
        "direction": "forward",
        "path": [
          "decisionLabels"
        ]
      }
    ]
  },
  "name": "DecisionLabelConfigButton_allLabels",
  "selections": [
    {
      "alias": "decisionLabels",
      "args": null,
      "concreteType": "DecisionLabelConnection",
      "kind": "LinkedField",
      "name": "__DecisionLabelConfigButtonAllLabels_decisionLabels_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionLabelEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionLabel",
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
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "name",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "color",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "9b3ddbe250993e314dbec5ce407a4f0a";

export default node;
