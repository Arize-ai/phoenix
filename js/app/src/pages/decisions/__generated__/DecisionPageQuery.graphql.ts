/**
 * @generated SignedSource<<0c6d2bf5c108aed8fda8b77f48ddb70d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionTemplateFormat = "F_STRING" | "MUSTACHE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type DecisionPageQuery$variables = {
  id: string;
  versionId?: string | null;
};
export type DecisionPageQuery$data = {
  readonly decision: {
    readonly __typename: "Decision";
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
    readonly version: {
      readonly createdAt: string;
      readonly customProvider: {
        readonly name: string;
      } | null;
      readonly description: string | null;
      readonly id: string;
      readonly inputs: ReadonlyArray<{
        readonly description: string | null;
        readonly jsonSchema: any | null;
        readonly name: string;
      }>;
      readonly metadata: any;
      readonly modelName: string;
      readonly modelProvider: GenerativeProviderKey;
      readonly questions: ReadonlyArray<{
        readonly __typename: "DecisionChoiceQuestion";
        readonly choices: ReadonlyArray<{
          readonly description: string | null;
          readonly value: string;
        }>;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionPredicateQuestion";
        readonly criteria: {
          readonly false: string | null;
          readonly true: string | null;
        } | null;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionScaleQuestion";
        readonly instructions: string;
        readonly levels: ReadonlyArray<{
          readonly description: string | null;
          readonly label: string;
        }>;
        readonly name: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
      readonly schemaVersion: number;
      readonly state: {
        readonly __typename: "DecisionInputState";
        readonly input: string;
      } | {
        readonly __typename: "DecisionTextState";
        readonly template: string;
        readonly templateFormat: DecisionTemplateFormat;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      };
    } | null;
    readonly versionTags: ReadonlyArray<{
      readonly decisionVersionId: string;
      readonly id: string;
      readonly name: string;
    }>;
    readonly " $fragmentSpreads": FragmentRefs<"DecisionPage_versions">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type DecisionPageQuery = {
  response: DecisionPageQuery$data;
  variables: DecisionPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "versionId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionVersionTag",
  "kind": "LinkedField",
  "name": "versionTags",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
    (v4/*:: as any*/),
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
v7 = [
  {
    "kind": "Variable",
    "name": "versionId",
    "variableName": "versionId"
  }
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "schemaVersion",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionInputDefinition",
  "kind": "LinkedField",
  "name": "inputs",
  "plural": true,
  "selections": [
    (v4/*:: as any*/),
    (v5/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "jsonSchema",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "state",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "template",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "templateFormat",
          "storageKey": null
        }
      ],
      "type": "DecisionTextState",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "input",
          "storageKey": null
        }
      ],
      "type": "DecisionInputState",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "questions",
  "plural": true,
  "selections": [
    (v2/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v4/*:: as any*/),
        (v15/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionPredicateCriteria",
          "kind": "LinkedField",
          "name": "criteria",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "true",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "false",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "type": "DecisionPredicateQuestion",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v4/*:: as any*/),
        (v15/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionChoiceOption",
          "kind": "LinkedField",
          "name": "choices",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "value",
              "storageKey": null
            },
            (v5/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "type": "DecisionChoiceQuestion",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v4/*:: as any*/),
        (v15/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionScaleLevel",
          "kind": "LinkedField",
          "name": "levels",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "label",
              "storageKey": null
            },
            (v5/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "type": "DecisionScaleQuestion",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v17 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 20
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionPageQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionPage_versions"
              },
              {
                "alias": null,
                "args": (v7/*:: as any*/),
                "concreteType": "DecisionVersion",
                "kind": "LinkedField",
                "name": "version",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v5/*:: as any*/),
                  (v8/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  (v12/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "GenerativeModelCustomProvider",
                    "kind": "LinkedField",
                    "name": "customProvider",
                    "plural": false,
                    "selections": [
                      (v4/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v13/*:: as any*/),
                  (v14/*:: as any*/),
                  (v16/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DecisionPageQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              {
                "alias": null,
                "args": (v17/*:: as any*/),
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
                          (v3/*:: as any*/),
                          (v10/*:: as any*/),
                          (v5/*:: as any*/),
                          (v8/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DecisionVersionTag",
                            "kind": "LinkedField",
                            "name": "tags",
                            "plural": true,
                            "selections": [
                              (v3/*:: as any*/),
                              (v4/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v2/*:: as any*/)
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
                "storageKey": "versions(first:20)"
              },
              {
                "alias": null,
                "args": (v17/*:: as any*/),
                "filters": null,
                "handle": "connection",
                "key": "DecisionPage_versions",
                "kind": "LinkedHandle",
                "name": "versions"
              },
              {
                "alias": null,
                "args": (v7/*:: as any*/),
                "concreteType": "DecisionVersion",
                "kind": "LinkedField",
                "name": "version",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v5/*:: as any*/),
                  (v8/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  (v12/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "GenerativeModelCustomProvider",
                    "kind": "LinkedField",
                    "name": "customProvider",
                    "plural": false,
                    "selections": [
                      (v4/*:: as any*/),
                      (v3/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v13/*:: as any*/),
                  (v14/*:: as any*/),
                  (v16/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ccf17294a2b0d86ca9a7d3ed503f264a",
    "id": null,
    "metadata": {},
    "name": "DecisionPageQuery",
    "operationKind": "query",
    "text": "query DecisionPageQuery(\n  $id: ID!\n  $versionId: ID\n) {\n  decision: node(id: $id) {\n    __typename\n    ... on Decision {\n      id\n      name\n      description\n      versionTags {\n        id\n        name\n        decisionVersionId\n      }\n      ...DecisionPage_versions\n      version(versionId: $versionId) {\n        id\n        description\n        modelName\n        modelProvider\n        createdAt\n        schemaVersion\n        metadata\n        customProvider {\n          name\n          id\n        }\n        inputs {\n          name\n          description\n          jsonSchema\n        }\n        state {\n          __typename\n          ... on DecisionTextState {\n            template\n            templateFormat\n          }\n          ... on DecisionInputState {\n            input\n          }\n        }\n        questions {\n          __typename\n          ... on DecisionPredicateQuestion {\n            name\n            instructions\n            criteria {\n              true\n              false\n            }\n          }\n          ... on DecisionChoiceQuestion {\n            name\n            instructions\n            choices {\n              value\n              description\n            }\n          }\n          ... on DecisionScaleQuestion {\n            name\n            instructions\n            levels {\n              label\n              description\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment DecisionPage_versions on Decision {\n  versions(first: 20) {\n    edges {\n      node {\n        id\n        createdAt\n        description\n        modelName\n        tags {\n          id\n          name\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "4667de0ed6cc58611528982097485f99";

export default node;
