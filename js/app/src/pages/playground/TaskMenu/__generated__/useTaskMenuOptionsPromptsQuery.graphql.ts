/**
 * @generated SignedSource<<76b0b20f86c670982869be13b35cd35e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useTaskMenuOptionsPromptsQuery$variables = {
  includePrompts: boolean;
};
export type useTaskMenuOptionsPromptsQuery$data = {
  readonly prompts?: {
    readonly edges: ReadonlyArray<{
      readonly prompt: {
        readonly __typename: "Prompt";
        readonly id: string;
        readonly name: string;
        readonly promptVersions: {
          readonly versions: ReadonlyArray<{
            readonly version: {
              readonly createdAt: string;
              readonly description: string | null;
              readonly id: string;
              readonly isLatest: boolean;
              readonly tags: ReadonlyArray<{
                readonly name: string;
              }>;
            };
          }>;
        };
        readonly versionTags: ReadonlyArray<{
          readonly name: string;
        }>;
      };
    }>;
  };
};
export type useTaskMenuOptionsPromptsQuery = {
  response: useTaskMenuOptionsPromptsQuery$data;
  variables: useTaskMenuOptionsPromptsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "includePrompts"
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 200
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
v5 = [
  (v4/*:: as any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isLatest",
  "storageKey": null
},
v9 = [
  (v4/*:: as any*/),
  (v3/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useTaskMenuOptionsPromptsQuery",
    "selections": [
      {
        "condition": "includePrompts",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v1/*:: as any*/),
            "concreteType": "PromptConnection",
            "kind": "LinkedField",
            "name": "prompts",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": "prompt",
                    "args": null,
                    "concreteType": "Prompt",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "versionTags",
                        "plural": true,
                        "selections": (v5/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionConnection",
                        "kind": "LinkedField",
                        "name": "promptVersions",
                        "plural": false,
                        "selections": [
                          {
                            "alias": "versions",
                            "args": null,
                            "concreteType": "PromptVersionEdge",
                            "kind": "LinkedField",
                            "name": "edges",
                            "plural": true,
                            "selections": [
                              {
                                "alias": "version",
                                "args": null,
                                "concreteType": "PromptVersion",
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": [
                                  (v3/*:: as any*/),
                                  (v6/*:: as any*/),
                                  (v7/*:: as any*/),
                                  (v8/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptVersionTag",
                                    "kind": "LinkedField",
                                    "name": "tags",
                                    "plural": true,
                                    "selections": (v5/*:: as any*/),
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "prompts(first:200)"
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useTaskMenuOptionsPromptsQuery",
    "selections": [
      {
        "condition": "includePrompts",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v1/*:: as any*/),
            "concreteType": "PromptConnection",
            "kind": "LinkedField",
            "name": "prompts",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": "prompt",
                    "args": null,
                    "concreteType": "Prompt",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "versionTags",
                        "plural": true,
                        "selections": (v9/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionConnection",
                        "kind": "LinkedField",
                        "name": "promptVersions",
                        "plural": false,
                        "selections": [
                          {
                            "alias": "versions",
                            "args": null,
                            "concreteType": "PromptVersionEdge",
                            "kind": "LinkedField",
                            "name": "edges",
                            "plural": true,
                            "selections": [
                              {
                                "alias": "version",
                                "args": null,
                                "concreteType": "PromptVersion",
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": [
                                  (v3/*:: as any*/),
                                  (v6/*:: as any*/),
                                  (v7/*:: as any*/),
                                  (v8/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptVersionTag",
                                    "kind": "LinkedField",
                                    "name": "tags",
                                    "plural": true,
                                    "selections": (v9/*:: as any*/),
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "prompts(first:200)"
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "863999aea82b39fee8574a9ca24e4662",
    "id": null,
    "metadata": {},
    "name": "useTaskMenuOptionsPromptsQuery",
    "operationKind": "query",
    "text": "query useTaskMenuOptionsPromptsQuery(\n  $includePrompts: Boolean!\n) {\n  prompts(first: 200) @include(if: $includePrompts) {\n    edges {\n      prompt: node {\n        __typename\n        id\n        name\n        versionTags {\n          name\n          id\n        }\n        promptVersions {\n          versions: edges {\n            version: node {\n              id\n              createdAt\n              description\n              isLatest\n              tags {\n                name\n                id\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c141c6e799070b2d400c1cda863d7e44";

export default node;
