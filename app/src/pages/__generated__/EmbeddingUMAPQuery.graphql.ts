/**
 * @generated SignedSource<<a2dc28fd7d7dc96c7f0dbacbc6a12508>>
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
      readonly clusters: ReadonlyArray<{
        readonly id: string;
        readonly pointUuids: ReadonlyArray<String>;
      }>;
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
        readonly embeddingMetadata: {
          readonly linkToData: string | null;
          readonly rawData: string | null;
        };
        readonly eventMetadata: {
          readonly actualLabel: string | null;
          readonly actualScore: number | null;
          readonly predictionId: string;
          readonly predictionLabel: string | null;
          readonly predictionScore: number | null;
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
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
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "EmbeddingMetadata",
              "kind": "LinkedField",
              "name": "embeddingMetadata",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "linkToData",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "rawData",
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "EventMetadata",
              "kind": "LinkedField",
              "name": "eventMetadata",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "predictionId",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "predictionLabel",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "actualLabel",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "predictionScore",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "actualScore",
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
          "concreteType": "Cluster",
          "kind": "LinkedField",
          "name": "clusters",
          "plural": true,
          "selections": [
            (v3/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "pointUuids",
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
          (v4/*: any*/)
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
          (v4/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "01ce74bd335899a71627ff8053486290",
    "id": null,
    "metadata": {},
    "name": "EmbeddingUMAPQuery",
    "operationKind": "query",
    "text": "query EmbeddingUMAPQuery(\n  $id: GlobalID!\n  $timeRange: TimeRange!\n) {\n  embedding: node(id: $id) {\n    __typename\n    ... on EmbeddingDimension {\n      UMAPPoints(timeRange: $timeRange) {\n        data {\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionId\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        clusters {\n          id\n          pointUuids\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2a0d173bb7f40617070e012af32a2d19";

export default node;
