/**
 * @generated SignedSource<<a730a70326bf5d7d438a6cd31ef72815>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
export type CodeEvaluatorVersionsQuery$variables = {
  codeEvaluatorId: string;
};
export type CodeEvaluatorVersionsQuery$data = {
  readonly node: {
    readonly __typename: "CodeEvaluator";
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
};
export type CodeEvaluatorVersionsQuery = {
  response: CodeEvaluatorVersionsQuery$data;
  variables: CodeEvaluatorVersionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "codeEvaluatorId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "codeEvaluatorId"
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
  "name": "sourceCode",
  "storageKey": null
},
v5 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "language",
      "storageKey": null
    },
    {
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
                (v4/*:: as any*/),
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
                    (v4/*:: as any*/)
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
    }
  ],
  "type": "CodeEvaluator",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CodeEvaluatorVersionsQuery",
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
          (v5/*:: as any*/)
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
    "name": "CodeEvaluatorVersionsQuery",
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
          (v5/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "bc2116271cd248bbe7bdba8f550b66dd",
    "id": null,
    "metadata": {},
    "name": "CodeEvaluatorVersionsQuery",
    "operationKind": "query",
    "text": "query CodeEvaluatorVersionsQuery(\n  $codeEvaluatorId: ID!\n) {\n  node(id: $codeEvaluatorId) {\n    __typename\n    ... on CodeEvaluator {\n      language\n      versions(first: 50) {\n        edges {\n          node {\n            id\n            sequenceNumber\n            sourceCode\n            createdAt\n            user {\n              id\n              username\n              profilePictureUrl\n            }\n            previousVersion {\n              id\n              sourceCode\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0c15340cd32388012dae6fa9af38f608";

export default node;
