/**
 * @generated SignedSource<<e68104ef2847011850445990f98e4797>>
 * @lightSyntaxTransform
 * @nogrep
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
            };
          }>;
        };
      };
    }>;
  };
};
export type PromptMenuQuery = {
  response: PromptMenuQuery$data;
  variables: PromptMenuQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Literal",
        "name": "first",
        "value": 200
      }
    ],
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
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              (v0/*: any*/),
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
                          (v0/*: any*/),
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
                            "name": "description",
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
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptMenuQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PromptMenuQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6b9cfca9e19dfded03a20020f13b0b0b",
    "id": null,
    "metadata": {},
    "name": "PromptMenuQuery",
    "operationKind": "query",
    "text": "query PromptMenuQuery {\n  prompts(first: 200) {\n    edges {\n      prompt: node {\n        __typename\n        id\n        name\n        promptVersions {\n          versions: edges {\n            version: node {\n              id\n              createdAt\n              description\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c9264cee23f8e7244a3191e50d37ff0c";

export default node;
