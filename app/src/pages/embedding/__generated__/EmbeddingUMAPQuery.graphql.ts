/**
 * @generated SignedSource<<aafd3c35800d3b6ecb469a4401ee4af0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type DataSelector = {
  dataSampler?: DataSampler | null;
  timeRange?: TimeRange | null;
};
export type TimeRange = {
  end: string;
  start: string;
};
export type DataSampler = {
  nSamples: number;
  seed: number;
};
export type DimensionalityReducer = {
  tsne?: TsneConfig | null;
  umap?: UmapConfig | null;
};
export type UmapConfig = {
  minDist?: number | null;
  nComponents?: number | null;
  nNeighbors?: number | null;
};
export type TsneConfig = {
  nComponents?: number | null;
  perplexity?: number | null;
};
export type ClustersFinder = {
  hdbscan?: HdbscanConfig | null;
  kmeans?: KmeansConfig | null;
};
export type HdbscanConfig = {
  clusterSelectionEpsilon?: number | null;
  minClusterSize?: number | null;
  minSamples?: number | null;
};
export type KmeansConfig = {
  nClusters?: number | null;
};
export type EmbeddingUMAPQuery$variables = {
  clustersFinder: ClustersFinder;
  dataSelector: DataSelector;
  dimensionalityReducer: DimensionalityReducer;
  id: string;
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
  "name": "clustersFinder"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "dataSelector"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "dimensionalityReducer"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "x",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "y",
  "storageKey": null
},
v9 = [
  (v5/*: any*/),
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
      (v6/*: any*/),
      {
        "kind": "InlineFragment",
        "selections": [
          (v7/*: any*/),
          (v8/*: any*/),
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
          (v7/*: any*/),
          (v8/*: any*/)
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
v10 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "clustersFinder",
          "variableName": "clustersFinder"
        },
        {
          "kind": "Variable",
          "name": "dataSelector",
          "variableName": "dataSelector"
        },
        {
          "kind": "Variable",
          "name": "dimensionalityReducer",
          "variableName": "dimensionalityReducer"
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
          "selections": (v9/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "UMAPPoint",
          "kind": "LinkedField",
          "name": "referenceData",
          "plural": true,
          "selections": (v9/*: any*/),
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
            (v5/*: any*/),
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
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*: any*/)
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
      (v3/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          (v10/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v5/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2466f84d91e56e6166e54d5b4590b08b",
    "id": null,
    "metadata": {},
    "name": "EmbeddingUMAPQuery",
    "operationKind": "query",
    "text": "query EmbeddingUMAPQuery(\n  $id: GlobalID!\n  $dataSelector: DataSelector!\n  $dimensionalityReducer: DimensionalityReducer!\n  $clustersFinder: ClustersFinder!\n) {\n  embedding: node(id: $id) {\n    __typename\n    ... on EmbeddingDimension {\n      UMAPPoints(dataSelector: $dataSelector, dimensionalityReducer: $dimensionalityReducer, clustersFinder: $clustersFinder) {\n        data {\n          id\n          eventId\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n            ... on Point2D {\n              x\n              y\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        referenceData {\n          id\n          eventId\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n            ... on Point2D {\n              x\n              y\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        clusters {\n          id\n          eventIds\n          driftRatio\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f9ea243ce596d991d79c84a377dd306e";

export default node;
