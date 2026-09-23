/**
 * @generated SignedSource<<d08180a15d953682462261773870fcd6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
export type CodeDatasetEvaluatorVersionsQuery$variables = {
  datasetEvaluatorId: string;
};
export type CodeDatasetEvaluatorVersionsQuery$data = {
  readonly node: {
    readonly __typename: "DatasetEvaluator";
    readonly evaluator: {
      readonly __typename: "CodeEvaluator";
      readonly id: string;
      readonly language: Language;
      readonly versions: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly createdAt: string;
            readonly id: string;
            readonly previousVersion: {
              readonly id: string;
              readonly sourceCode: string;
            } | null;
            readonly sequenceNumber: number;
            readonly sourceCode: string;
            readonly user: {
              readonly id: string;
              readonly profilePictureUrl: string | null;
              readonly username: string;
            } | null;
          };
        }>;
      };
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type CodeDatasetEvaluatorVersionsQuery = {
  response: CodeDatasetEvaluatorVersionsQuery$data;
  variables: CodeDatasetEvaluatorVersionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetEvaluatorId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetEvaluatorId"
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
  "name": "language",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sourceCode",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 50
    }
  ],
  "concreteType": "CodeEvaluatorVersionConnection",
  "kind": "LinkedField",
  "name": "versions",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "CodeEvaluatorVersionEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "CodeEvaluatorVersion",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v3/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "sequenceNumber",
              "storageKey": null
            },
            (v5/*:: as any*/),
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
              "concreteType": "User",
              "kind": "LinkedField",
              "name": "user",
              "plural": false,
              "selections": [
                (v3/*:: as any*/),
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
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "CodeEvaluatorVersion",
              "kind": "LinkedField",
              "name": "previousVersion",
              "plural": false,
              "selections": [
                (v3/*:: as any*/),
                (v5/*:: as any*/)
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
  "storageKey": "versions(first:50)"
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CodeDatasetEvaluatorVersionsQuery",
    "selections": [
      {
        "alias": null,
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
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v6/*:: as any*/)
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "DatasetEvaluator",
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
    "name": "CodeDatasetEvaluatorVersionsQuery",
    "selections": [
      {
        "alias": null,
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
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v4/*:: as any*/),
                      (v6/*:: as any*/)
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "DatasetEvaluator",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "57ff6e03100fc60e91946bbcae697554",
    "id": null,
    "metadata": {},
    "name": "CodeDatasetEvaluatorVersionsQuery",
    "operationKind": "query",
    "text": "query CodeDatasetEvaluatorVersionsQuery(\n  $datasetEvaluatorId: ID!\n) {\n  node(id: $datasetEvaluatorId) {\n    __typename\n    ... on DatasetEvaluator {\n      evaluator {\n        __typename\n        ... on CodeEvaluator {\n          id\n          language\n          versions(first: 50) {\n            edges {\n              node {\n                id\n                sequenceNumber\n                sourceCode\n                createdAt\n                user {\n                  id\n                  username\n                  profilePictureUrl\n                }\n                previousVersion {\n                  id\n                  sourceCode\n                }\n              }\n            }\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3f38ac39cc570588e9ff3f32426ab3a3";

export default node;
