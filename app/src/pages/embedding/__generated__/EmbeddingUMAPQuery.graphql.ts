/**
 * @generated SignedSource<<efc62aca851aac73084b393e13e479af>>
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
  clusterMinSamples: number;
  clusterSelectionEpsilon: number;
  id: string;
  minClusterSize: number;
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
        readonly eventIds: ReadonlyArray<string>;
        readonly id: string;
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
        readonly eventId: string;
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
        readonly eventId: string;
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
  "name": "clusterMinSamples"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "clusterSelectionEpsilon"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "minClusterSize"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "minDist"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "nNeighbors"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "nSamples"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v8 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "x",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "y",
  "storageKey": null
},
v13 = [
  (v9/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "eventId",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": null,
    "kind": "LinkedField",
    "name": "coordinates",
    "plural": false,
    "selections": [
      (v10/*: any*/),
      {
        "kind": "InlineFragment",
        "selections": [
          (v11/*: any*/),
          (v12/*: any*/),
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
          (v11/*: any*/),
          (v12/*: any*/)
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
v14 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "clusterMinSamples",
          "variableName": "clusterMinSamples"
        },
        {
          "kind": "Variable",
          "name": "clusterSelectionEpsilon",
          "variableName": "clusterSelectionEpsilon"
        },
        {
          "kind": "Variable",
          "name": "minClusterSize",
          "variableName": "minClusterSize"
        },
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
          "selections": (v13/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "UMAPPoint",
          "kind": "LinkedField",
          "name": "referenceData",
          "plural": true,
          "selections": (v13/*: any*/),
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
            (v9/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "eventIds",
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
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v8/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v14/*: any*/)
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
      (v2/*: any*/),
      (v7/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v3/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v8/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*: any*/),
          (v14/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v9/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c631c258a7dd02bdd681c40ad8dc4e4b",
    "id": null,
    "metadata": {},
    "name": "EmbeddingUMAPQuery",
    "operationKind": "query",
    "text": "query EmbeddingUMAPQuery(\n  $id: GlobalID!\n  $timeRange: TimeRange!\n  $minDist: Float!\n  $nNeighbors: Int!\n  $nSamples: Int!\n  $minClusterSize: Int!\n  $clusterMinSamples: Int!\n  $clusterSelectionEpsilon: Int!\n) {\n  embedding: node(id: $id) {\n    __typename\n    ... on EmbeddingDimension {\n      UMAPPoints(timeRange: $timeRange, minDist: $minDist, nNeighbors: $nNeighbors, nSamples: $nSamples, minClusterSize: $minClusterSize, clusterMinSamples: $clusterMinSamples, clusterSelectionEpsilon: $clusterSelectionEpsilon) {\n        data {\n          id\n          eventId\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n            ... on Point2D {\n              x\n              y\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        referenceData {\n          id\n          eventId\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n            ... on Point2D {\n              x\n              y\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        clusters {\n          id\n          eventIds\n          driftRatio\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "aaedcb83e9ef94fd13cb33af3d49184b";

export default node;
