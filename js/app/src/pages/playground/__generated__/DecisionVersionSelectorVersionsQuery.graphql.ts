/**
 * @generated SignedSource<<aec54cbc4756dbe593a5aee92fecf402>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionVersionSelectorVersionsQuery$variables = {
  decisionId: string;
};
export type DecisionVersionSelectorVersionsQuery$data = {
  readonly decision: {
    readonly versionTags?: ReadonlyArray<{
      readonly decisionVersionId: string;
      readonly name: string;
    }>;
    readonly versions?: {
      readonly edges: ReadonlyArray<{
        readonly version: {
          readonly createdAt: string;
          readonly description: string | null;
          readonly id: string;
          readonly modelName: string;
          readonly sequenceNumber: number;
        };
      }>;
    };
  };
};
export type DecisionVersionSelectorVersionsQuery = {
  response: DecisionVersionSelectorVersionsQuery$data;
  variables: DecisionVersionSelectorVersionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "decisionId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "decisionId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "decisionVersionId",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 100
    }
  ],
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
          "alias": "version",
          "args": null,
          "concreteType": "DecisionVersion",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v4/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "sequenceNumber",
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
              "name": "modelName",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "createdAt",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "versions(first:100)"
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionVersionSelectorVersionsQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionVersionTag",
                "kind": "LinkedField",
                "name": "versionTags",
                "plural": true,
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              },
              (v5/*:: as any*/)
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
    "name": "DecisionVersionSelectorVersionsQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v1/*:: as any*/),
        "concreteType": null,
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
          {
            "kind": "InlineFragment",
            "selections": [
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
                  (v4/*:: as any*/)
                ],
                "storageKey": null
              },
              (v5/*:: as any*/)
            ],
            "type": "Decision",
            "abstractKey": null
          },
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c3595c9350ea0c96eb4a0a991cd03b03",
    "id": null,
    "metadata": {},
    "name": "DecisionVersionSelectorVersionsQuery",
    "operationKind": "query",
    "text": "query DecisionVersionSelectorVersionsQuery(\n  $decisionId: ID!\n) {\n  decision: node(id: $decisionId) {\n    __typename\n    ... on Decision {\n      versionTags {\n        name\n        decisionVersionId\n        id\n      }\n      versions(first: 100) {\n        edges {\n          version: node {\n            id\n            sequenceNumber\n            description\n            modelName\n            createdAt\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "1f53cd5215c2f925984f3848de49a8f7";

export default node;
