/**
 * @generated SignedSource<<89c6aef5d2afca6ef652c753f99184c8>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PromptMenuQuery$variables = Record<PropertyKey, never>;
export type PromptMenuQuery$data = {
  readonly prompts: {
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
export type PromptMenuQuery = {
  response: PromptMenuQuery$data;
  variables: PromptMenuQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 200
  }
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
v4 = [
  (v3/*:: as any*/)
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isLatest",
  "storageKey": null
},
v8 = [
  (v3/*:: as any*/),
  (v2/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptMenuQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
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
                  (v1/*:: as any*/),
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersionTag",
                    "kind": "LinkedField",
                    "name": "versionTags",
                    "plural": true,
                    "selections": (v4/*:: as any*/),
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
                              (v2/*:: as any*/),
                              (v5/*:: as any*/),
                              (v6/*:: as any*/),
                              (v7/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "PromptVersionTag",
                                "kind": "LinkedField",
                                "name": "tags",
                                "plural": true,
                                "selections": (v4/*:: as any*/),
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
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PromptMenuQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
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
                  (v1/*:: as any*/),
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersionTag",
                    "kind": "LinkedField",
                    "name": "versionTags",
                    "plural": true,
                    "selections": (v8/*:: as any*/),
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
                              (v2/*:: as any*/),
                              (v5/*:: as any*/),
                              (v6/*:: as any*/),
                              (v7/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "PromptVersionTag",
                                "kind": "LinkedField",
                                "name": "tags",
                                "plural": true,
                                "selections": (v8/*:: as any*/),
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
  },
  "params": {
    "cacheID": "d8093a3c4cb80b9b6461decf6f368be1",
    "id": null,
    "metadata": {},
    "name": "PromptMenuQuery",
    "operationKind": "query",
    "text": "query PromptMenuQuery {\n  prompts(first: 200) {\n    edges {\n      prompt: node {\n        __typename\n        id\n        name\n        versionTags {\n          name\n          id\n        }\n        promptVersions {\n          versions: edges {\n            version: node {\n              id\n              createdAt\n              description\n              isLatest\n              tags {\n                name\n                id\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "054ed2e51bbda434d7a88e723ed63865";

export default node;
