/**
 * @generated SignedSource<<af42807769944772ba5cd185c9dbac8a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
import { FragmentRefs } from "relay-runtime";
export type PromptsTable_items$data = {
  readonly promptsAndDecisions: {
    readonly edges: ReadonlyArray<{
      readonly item: {
        readonly __typename: "Decision";
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
        readonly latestVersion: {
          readonly createdAt: string;
          readonly id: string;
          readonly modelName: string;
          readonly modelProvider: GenerativeProviderKey;
        } | null;
        readonly name: string;
        readonly updatedAt: string;
        readonly updatedBy: {
          readonly profilePictureUrl: string | null;
          readonly username: string;
        } | null;
        readonly versionCount: number;
        readonly versionTags: ReadonlyArray<{
          readonly decisionVersionId: string;
          readonly id: string;
          readonly name: string;
        }>;
      } | {
        readonly __typename: "Prompt";
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
        readonly updatedBy: {
          readonly profilePictureUrl: string | null;
          readonly username: string;
        } | null;
        readonly version: {
          readonly createdAt: string;
          readonly id: string;
          readonly modelName: string;
          readonly modelProvider: ModelProvider;
        };
        readonly versionCount: number;
        readonly versionTags: ReadonlyArray<{
          readonly id: string;
          readonly name: string;
          readonly promptVersionId: string;
        }>;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      };
    }>;
  };
  readonly " $fragmentType": "PromptsTable_items";
};
export type PromptsTable_items$key = {
  readonly " $data"?: PromptsTable_items$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptsTable_items">;
};

import PromptsTableItemsQuery_graphql from './PromptsTableItemsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "promptsAndDecisions"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = [
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
],
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "createdBy",
  "plural": false,
  "selections": (v5/*:: as any*/),
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "updatedBy",
  "plural": false,
  "selections": (v5/*:: as any*/),
  "storageKey": null
},
v8 = [
  (v2/*:: as any*/),
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
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "versionCount",
  "storageKey": null
},
v10 = [
  (v2/*:: as any*/),
  (v3/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "color",
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
      "operation": PromptsTableItemsQuery_graphql
    }
  },
  "name": "PromptsTable_items",
  "selections": [
    {
      "alias": "promptsAndDecisions",
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
      "concreteType": "PromptOrDecisionConnection",
      "kind": "LinkedField",
      "name": "__PromptsTable_promptsAndDecisions_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptOrDecisionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "item",
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*:: as any*/),
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v2/*:: as any*/),
                    (v3/*:: as any*/),
                    (v4/*:: as any*/),
                    (v6/*:: as any*/),
                    (v7/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "PromptVersion",
                      "kind": "LinkedField",
                      "name": "version",
                      "plural": false,
                      "selections": (v8/*:: as any*/),
                      "storageKey": null
                    },
                    (v9/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "PromptVersionTag",
                      "kind": "LinkedField",
                      "name": "versionTags",
                      "plural": true,
                      "selections": [
                        (v2/*:: as any*/),
                        (v3/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "promptVersionId",
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "PromptLabel",
                      "kind": "LinkedField",
                      "name": "labels",
                      "plural": true,
                      "selections": (v10/*:: as any*/),
                      "storageKey": null
                    }
                  ],
                  "type": "Prompt",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v2/*:: as any*/),
                    (v3/*:: as any*/),
                    (v4/*:: as any*/),
                    (v6/*:: as any*/),
                    (v7/*:: as any*/),
                    {
                      "alias": "latestVersion",
                      "args": null,
                      "concreteType": "DecisionVersion",
                      "kind": "LinkedField",
                      "name": "version",
                      "plural": false,
                      "selections": (v8/*:: as any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "updatedAt",
                      "storageKey": null
                    },
                    (v9/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "DecisionVersionTag",
                      "kind": "LinkedField",
                      "name": "versionTags",
                      "plural": true,
                      "selections": [
                        (v2/*:: as any*/),
                        (v3/*:: as any*/),
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
                      "selections": (v10/*:: as any*/),
                      "storageKey": null
                    }
                  ],
                  "type": "Decision",
                  "abstractKey": null
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
              "concreteType": null,
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*:: as any*/)
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

(node as any).hash = "c2971eeadef6a7c42fb76bb98f6b7939";

export default node;
