/**
 * @generated SignedSource<<82b459c7fbab9cd9838c7f1125866dac>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PerformanceMetric = "accuracyScore";
export type TimeRange = {
  end: string;
  start: string;
};
export type EmbeddingUMAPQuery$variables = {
  clusterMinSamples: number;
  clusterSelectionEpsilon: number;
  dataQualityMetricColumnName?: string | null;
  fetchDataQualityMetric: boolean;
  fetchPerformanceMetric: boolean;
  id: string;
  minClusterSize: number;
  minDist: number;
  nNeighbors: number;
  nSamples: number;
  performanceMetric: PerformanceMetric;
  timeRange: TimeRange;
};
export type EmbeddingUMAPQuery$data = {
  readonly embedding: {
    readonly UMAPPoints?: {
      readonly clusters: ReadonlyArray<{
        readonly dataQualityMetric?: {
          readonly primaryValue: number | null;
          readonly referenceValue: number | null;
        };
        readonly driftRatio: number | null;
        readonly eventIds: ReadonlyArray<string>;
        readonly id: string;
        readonly performanceMetric?: {
          readonly primaryValue: number | null;
          readonly referenceValue: number | null;
        };
        readonly primaryToCorpusRatio: number | null;
      }>;
      readonly contextRetrievals: ReadonlyArray<{
        readonly documentId: string;
        readonly queryId: string;
        readonly relevance: number | null;
      }>;
      readonly corpusData: ReadonlyArray<{
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
          readonly predictionId: string | null;
          readonly predictionLabel: string | null;
          readonly predictionScore: number | null;
        };
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
          readonly predictionId: string | null;
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
          readonly predictionId: string | null;
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
  "name": "dataQualityMetricColumnName"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "fetchDataQualityMetric"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "fetchPerformanceMetric"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "minClusterSize"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "minDist"
},
v8 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "nNeighbors"
},
v9 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "nSamples"
},
v10 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "performanceMetric"
},
v11 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v12 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "x",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "y",
  "storageKey": null
},
v17 = [
  (v13/*: any*/),
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
      (v14/*: any*/),
      {
        "kind": "InlineFragment",
        "selections": [
          (v15/*: any*/),
          (v16/*: any*/),
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
          (v15/*: any*/),
          (v16/*: any*/)
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
v18 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "primaryValue",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "referenceValue",
    "storageKey": null
  }
],
v19 = {
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
          "selections": (v17/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "UMAPPoint",
          "kind": "LinkedField",
          "name": "referenceData",
          "plural": true,
          "selections": (v17/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "UMAPPoint",
          "kind": "LinkedField",
          "name": "corpusData",
          "plural": true,
          "selections": (v17/*: any*/),
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
            (v13/*: any*/),
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
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "primaryToCorpusRatio",
              "storageKey": null
            },
            {
              "condition": "fetchDataQualityMetric",
              "kind": "Condition",
              "passingValue": true,
              "selections": [
                {
                  "alias": null,
                  "args": [
                    {
                      "fields": [
                        {
                          "kind": "Variable",
                          "name": "columnName",
                          "variableName": "dataQualityMetricColumnName"
                        },
                        {
                          "kind": "Literal",
                          "name": "metric",
                          "value": "mean"
                        }
                      ],
                      "kind": "ObjectValue",
                      "name": "metric"
                    }
                  ],
                  "concreteType": "DatasetValues",
                  "kind": "LinkedField",
                  "name": "dataQualityMetric",
                  "plural": false,
                  "selections": (v18/*: any*/),
                  "storageKey": null
                }
              ]
            },
            {
              "condition": "fetchPerformanceMetric",
              "kind": "Condition",
              "passingValue": true,
              "selections": [
                {
                  "alias": null,
                  "args": [
                    {
                      "fields": [
                        {
                          "kind": "Variable",
                          "name": "metric",
                          "variableName": "performanceMetric"
                        }
                      ],
                      "kind": "ObjectValue",
                      "name": "metric"
                    }
                  ],
                  "concreteType": "DatasetValues",
                  "kind": "LinkedField",
                  "name": "performanceMetric",
                  "plural": false,
                  "selections": (v18/*: any*/),
                  "storageKey": null
                }
              ]
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "Retrieval",
          "kind": "LinkedField",
          "name": "contextRetrievals",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "queryId",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "documentId",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "relevance",
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
      (v7/*: any*/),
      (v8/*: any*/),
      (v9/*: any*/),
      (v10/*: any*/),
      (v11/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v12/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v19/*: any*/)
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
      (v5/*: any*/),
      (v11/*: any*/),
      (v7/*: any*/),
      (v8/*: any*/),
      (v9/*: any*/),
      (v6/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/),
      (v3/*: any*/),
      (v2/*: any*/),
      (v4/*: any*/),
      (v10/*: any*/)
    ],
    "kind": "Operation",
    "name": "EmbeddingUMAPQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v12/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v14/*: any*/),
          (v19/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v13/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "88dc5478ae248f2e863fd779a080f725",
    "id": null,
    "metadata": {},
    "name": "EmbeddingUMAPQuery",
    "operationKind": "query",
    "text": "query EmbeddingUMAPQuery(\n  $id: GlobalID!\n  $timeRange: TimeRange!\n  $minDist: Float!\n  $nNeighbors: Int!\n  $nSamples: Int!\n  $minClusterSize: Int!\n  $clusterMinSamples: Int!\n  $clusterSelectionEpsilon: Float!\n  $fetchDataQualityMetric: Boolean!\n  $dataQualityMetricColumnName: String\n  $fetchPerformanceMetric: Boolean!\n  $performanceMetric: PerformanceMetric!\n) {\n  embedding: node(id: $id) {\n    __typename\n    ... on EmbeddingDimension {\n      UMAPPoints(timeRange: $timeRange, minDist: $minDist, nNeighbors: $nNeighbors, nSamples: $nSamples, minClusterSize: $minClusterSize, clusterMinSamples: $clusterMinSamples, clusterSelectionEpsilon: $clusterSelectionEpsilon) {\n        data {\n          id\n          eventId\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n            ... on Point2D {\n              x\n              y\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionId\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        referenceData {\n          id\n          eventId\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n            ... on Point2D {\n              x\n              y\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionId\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        corpusData {\n          id\n          eventId\n          coordinates {\n            __typename\n            ... on Point3D {\n              x\n              y\n              z\n            }\n            ... on Point2D {\n              x\n              y\n            }\n          }\n          embeddingMetadata {\n            linkToData\n            rawData\n          }\n          eventMetadata {\n            predictionId\n            predictionLabel\n            actualLabel\n            predictionScore\n            actualScore\n          }\n        }\n        clusters {\n          id\n          eventIds\n          driftRatio\n          primaryToCorpusRatio\n          dataQualityMetric(metric: {columnName: $dataQualityMetricColumnName, metric: mean}) @include(if: $fetchDataQualityMetric) {\n            primaryValue\n            referenceValue\n          }\n          performanceMetric(metric: {metric: $performanceMetric}) @include(if: $fetchPerformanceMetric) {\n            primaryValue\n            referenceValue\n          }\n        }\n        contextRetrievals {\n          queryId\n          documentId\n          relevance\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2e2ccd0cea43753749c8f4329b708d12";

export default node;
