/**
 * @generated SignedSource<<ce7dd85cd4afd3098432acc2efb84b60>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeModelKind = "BUILT_IN" | "CUSTOM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type TokenKind = "COMPLETION" | "PROMPT";
import { FragmentRefs } from "relay-runtime";
export type ModelsTable_generativeModels$data = {
  readonly generativeModels: {
    readonly edges: ReadonlyArray<{
      readonly generativeModel: {
        readonly createdAt: string;
        readonly id: string;
        readonly kind: GenerativeModelKind;
        readonly lastUsedAt: string | null;
        readonly name: string;
        readonly namePattern: string;
        readonly provider: string | null;
        readonly providerKey: GenerativeProviderKey | null;
        readonly startTime: string | null;
        readonly tokenPrices: ReadonlyArray<{
          readonly costPerMillionTokens: number;
          readonly kind: TokenKind;
          readonly tokenType: string;
        }>;
        readonly updatedAt: string;
      };
    }>;
  };
  readonly " $fragmentType": "ModelsTable_generativeModels";
};
export type ModelsTable_generativeModels$key = {
  readonly " $data"?: ModelsTable_generativeModels$data;
  readonly " $fragmentSpreads": FragmentRefs<"ModelsTable_generativeModels">;
};

import ModelsTableGenerativeModelsQuery_graphql from './ModelsTableGenerativeModelsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "generativeModels"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 1000,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": ModelsTableGenerativeModelsQuery_graphql
    }
  },
  "name": "ModelsTable_generativeModels",
  "selections": [
    {
      "alias": "generativeModels",
      "args": null,
      "concreteType": "GenerativeModelConnection",
      "kind": "LinkedField",
      "name": "__ModelsTable_generativeModels_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "GenerativeModelEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "generativeModel",
              "args": null,
              "concreteType": "GenerativeModel",
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
                  "name": "provider",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "namePattern",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "providerKey",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "startTime",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "createdAt",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "updatedAt",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "lastUsedAt",
                  "storageKey": null
                },
                (v1/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "TokenPrice",
                  "kind": "LinkedField",
                  "name": "tokenPrices",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "tokenType",
                      "storageKey": null
                    },
                    (v1/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "costPerMillionTokens",
                      "storageKey": null
                    }
                  ],
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
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "GenerativeModel",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
              ],
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
})();

(node as any).hash = "e067fb55e7a09f7237e0cc8eb1eb4c75";

export default node;
