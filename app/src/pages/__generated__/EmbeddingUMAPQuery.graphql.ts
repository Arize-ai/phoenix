/**
 * @generated SignedSource<<0de2c378d6beccd46e07a02904fa13d6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type TimeRange = {
  end: String;
  start: String;
};
export type EmbeddingUMAPQuery$variables = {
  id: String;
  timeRange: TimeRange;
};
export type EmbeddingUMAPQuery$data = {
  readonly embedding: {
    readonly UMAPPoints?: {
      readonly data: ReadonlyArray<{
        readonly coordinates: {
          readonly __typename: "Point3D";
          readonly x: number;
          readonly y: number;
          readonly z: number;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        };
      }>;
    };
  };
};
export type EmbeddingUMAPQuery = {
  response: EmbeddingUMAPQuery$data;
  variables: EmbeddingUMAPQuery$variables;
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
    "name": "timeRange"
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "UMAPPoints",
      "kind": "LinkedField",
      "name": "UMAPPoints",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "UMAPPoint",
          "kind": "LinkedField",
          "name": "data",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "coordinates",
              "plural": false,
              "selections": [
                (v2/*: any*/),
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "x",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "y",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "z",
                      "storageKey": null
                    }
                  ],
                  "type": "Point3D",
                  "abstractKey": null
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
  "type": "EmbeddingDimension",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3d13b0a1c369cc7dba885474820a35fa",
    "id": null,
    "metadata": {},
    "name": "EmbeddingUMAPQuery",
    "operationKind": "query",
    "text": "query EmbeddingUMAPQuery(\n  $id: GlobalID!\n  $timeRange: TimeRange!\n) {\n  embedding: node(id: $id) {\n    __typename\n    ... on EmbeddingDimension {\n      UMAPPoints(timeRange: $timeRange) {\n        data {\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n          }\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "84ea173ffd4442218680a739ce4222a0";

export default node;
