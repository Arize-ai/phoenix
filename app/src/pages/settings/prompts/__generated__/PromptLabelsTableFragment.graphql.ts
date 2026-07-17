/**
 * @generated SignedSource<<fbdda0dbefdec7380aabae6ffdc8b1d2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelsTableFragment$data = {
  readonly promptLabels: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string | null;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
        readonly usageCount: number;
      };
    }>;
  };
  readonly " $fragmentType": "PromptLabelsTableFragment";
};
export type PromptLabelsTableFragment$key = {
  readonly " $data"?: PromptLabelsTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelsTableFragment">;
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
          "promptLabels"
        ]
      }
    ]
  },
  "name": "PromptLabelsTableFragment",
  "selections": [
    {
      "alias": "promptLabels",
      "args": null,
      "concreteType": "PromptLabelConnection",
      "kind": "LinkedField",
      "name": "__PromptLabelsTable__promptLabels_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptLabelEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "PromptLabel",
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
                  "name": "description",
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
                  "name": "usageCount",
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

(node as any).hash = "0d56a7fa3df2612dce4bcafd786cafd6";

export default node;
