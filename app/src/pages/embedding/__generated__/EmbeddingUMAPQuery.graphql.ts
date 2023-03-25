/**
 * @generated SignedSource<<ccbc78cae53b386eb27aaaf432336f86>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type TimeRange = {
  end: string;
  start: string;
};
export type EmbeddingUMAPQuery$variables = {
  id: string;
  minDist: number;
  nNeighbors: number;
  nSamples: number;
  timeRange: TimeRange;
};
export type EmbeddingUMAPQuery$data = {
  readonly embedding: {
    readonly UMAPPoints?: {
      readonly clusters: ReadonlyArray<{
        readonly driftRatio: number | null;
        readonly id: string;
        readonly pointIds: ReadonlyArray<string>;
      }>;
      readonly data: ReadonlyArray<{
        readonly coordinates: {
          readonly __typename: "Point2D";
          readonly x: number;
          readonly y: number;
        } | {
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
          readonly predictionLabel: string | null;
          readonly predictionScore: number | null;
        };
        readonly id: string;
      }>;
      readonly referenceData: ReadonlyArray<{
        readonly coordinates: {
          readonly __typename: "Point2D";
          readonly x: number;
          readonly y: number;
        } | {
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
          readonly predictionLabel: string | null;
          readonly predictionScore: number | null;
        };
        readonly id: string;
      }>;
    };
  };
};
export type EmbeddingUMAPQuery = {
  response: EmbeddingUMAPQuery$data;
  variables: EmbeddingUMAPQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "minDist"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "nNeighbors"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "nSamples"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "x",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "y",
  "storageKey": null
},
v10 = [
  (v6/*: any*/),
  {
    "alias": null,
    "args": null,
    "concreteType": null,
    "kind": "LinkedField",
    "name": "coordinates",
    "plural": false,
    "selections": [
      (v7/*: any*/),
      {
        "kind": "InlineFragment",
        "selections": [
          (v8/*: any*/),
          (v9/*: any*/),
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
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v8/*: any*/),
          (v9/*: any*/)
        ],
        "type": "Point2D",
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
v11 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "minDist",
          "variableName": "minDist"
        },
        {
          "kind": "Variable",
          "name": "nNeighbors",
          "variableName": "nNeighbors"
        },
        {
          "kind": "Variable",
          "name": "nSamples",
          "variableName": "nSamples"
        },
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
          "selections": (v10/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "UMAPPoint",
          "kind": "LinkedField",
          "name": "referenceData",
          "plural": true,
          "selections": (v10/*: any*/),
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
            (v6/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "pointIds",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "driftRatio",
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v5/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v4/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Operation",
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v5/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*: any*/),
          (v11/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "9b638c3d0f45451c419cee18213471b6",
    "id": null,
    "metadata": {},
    "name": "EmbeddingUMAPQuery",
    "operationKind": "query",
    "text": "query EmbeddingUMAPQuery(\n  $id: GlobalID!\n  $timeRange: TimeRange!\n  $minDist: Float!\n  $nNeighbors: Int!\n  $nSamples: Int!\n) {\n  embedding: node(id: $id) {\n    __typename\n    ... on EmbeddingDimension {\n      UMAPPoints(timeRange: $timeRange, minDist: $minDist, nNeighbors: $nNeighbors, nSamples: $nSamples) {\n        data {\n          id\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n            ... on Point2D {\n              x\n              y\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        referenceData {\n          id\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n            ... on Point2D {\n              x\n              y\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        clusters {\n          id\n          pointIds\n          driftRatio\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "286643183f67060759c1f1e56ca32edf";

export default node;
