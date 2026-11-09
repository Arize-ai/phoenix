/**
 * @generated SignedSource<<c0f7158c033a40b22fd05530b7752f95>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
import { FragmentRefs } from "relay-runtime";
export type DecisionsTable_decisions$data = {
  readonly decisions: {
    readonly edges: ReadonlyArray<{
      readonly decision: {
        readonly createdBy: {
          readonly profilePictureUrl: string | null;
          readonly username: string;
        } | null;
        readonly description: string | null;
        readonly id: string;
        readonly labels: ReadonlyArray<{
          readonly color: string | null;
          readonly id: string;
          readonly name: string;
        }>;
        readonly name: string;
        readonly updatedAt: string;
        readonly updatedBy: {
          readonly profilePictureUrl: string | null;
          readonly username: string;
        } | null;
        readonly version: {
          readonly createdAt: string;
          readonly id: string;
          readonly modelName: string;
          readonly modelProvider: GenerativeProviderKey;
        } | null;
        readonly versionCount: number;
        readonly versionTags: ReadonlyArray<{
          readonly decisionVersionId: string;
          readonly id: string;
          readonly name: string;
        }>;
      };
    }>;
  };
  readonly " $fragmentType": "DecisionsTable_decisions";
};
export type DecisionsTable_decisions$key = {
  readonly " $data"?: DecisionsTable_decisions$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionsTable_decisions">;
};

import DecisionsTableDecisionsQuery_graphql from './DecisionsTableDecisionsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "decisions"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "username",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "profilePictureUrl",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filter"
    },
    {
      "defaultValue": 100,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "labelIds"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*:: as any*/)
      },
      "fragmentPathInResult": [],
      "operation": DecisionsTableDecisionsQuery_graphql
    }
  },
  "name": "DecisionsTable_decisions",
  "selections": [
    {
      "alias": "decisions",
      "args": [
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
        },
        {
          "kind": "Variable",
          "name": "labelIds",
          "variableName": "labelIds"
        }
      ],
      "concreteType": "DecisionConnection",
      "kind": "LinkedField",
      "name": "__DecisionsTable_decisions_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "decision",
              "args": null,
              "concreteType": "Decision",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*:: as any*/),
                (v2/*:: as any*/),
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
                  "concreteType": "User",
                  "kind": "LinkedField",
                  "name": "createdBy",
                  "plural": false,
                  "selections": (v3/*:: as any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "User",
                  "kind": "LinkedField",
                  "name": "updatedBy",
                  "plural": false,
                  "selections": (v3/*:: as any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DecisionVersion",
                  "kind": "LinkedField",
                  "name": "version",
                  "plural": false,
                  "selections": [
                    (v1/*:: as any*/),
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
                      "name": "modelName",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "modelProvider",
                      "storageKey": null
                    }
                  ],
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
                  "name": "versionCount",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DecisionVersionTag",
                  "kind": "LinkedField",
                  "name": "versionTags",
                  "plural": true,
                  "selections": [
                    (v1/*:: as any*/),
                    (v2/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "decisionVersionId",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DecisionLabel",
                  "kind": "LinkedField",
                  "name": "labels",
                  "plural": true,
                  "selections": [
                    (v1/*:: as any*/),
                    (v2/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "color",
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
              "concreteType": "Decision",
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

(node as any).hash = "7089e596db7a46afb3709e5cc0091c95";

export default node;
