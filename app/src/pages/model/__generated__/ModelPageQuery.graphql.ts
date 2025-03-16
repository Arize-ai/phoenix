/**
 * @generated SignedSource<<ee5b40a7d9afe12123bc0e82d28fd443>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelPageQuery$variables = {
  endTime: string;
  startTime: string;
};
export type ModelPageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ModelEmbeddingsTable_embeddingDimensions" | "ModelSchemaTable_dimensions">;
};
export type ModelPageQuery = {
  response: ModelPageQuery$data;
  variables: ModelPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "endTime"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "startTime"
},
v2 = [
  {
    "kind": "Variable",
    "name": "endTime",
    "variableName": "endTime"
  },
  {
    "kind": "Variable",
    "name": "startTime",
    "variableName": "startTime"
  }
],
v3 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "fields": [
    {
      "kind": "Variable",
      "name": "end",
      "variableName": "endTime"
    },
    {
      "kind": "Variable",
      "name": "start",
      "variableName": "startTime"
    }
  ],
  "kind": "ObjectValue",
  "name": "timeRange"
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v8 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "__typename",
    "storageKey": null
  },
  (v4/*: any*/)
],
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "PageInfo",
  "kind": "LinkedField",
  "name": "pageInfo",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endCursor",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasNextPage",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ModelPageQuery",
    "selections": [
      {
        "args": (v2/*: any*/),
        "kind": "FragmentSpread",
        "name": "ModelSchemaTable_dimensions"
      },
      {
        "args": (v2/*: any*/),
        "kind": "FragmentSpread",
        "name": "ModelEmbeddingsTable_embeddingDimensions"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "ModelPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Model",
        "kind": "LinkedField",
        "name": "model",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": (v3/*: any*/),
            "concreteType": "DimensionConnection",
            "kind": "LinkedField",
            "name": "dimensions",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DimensionEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": "dimension",
                    "args": null,
                    "concreteType": "Dimension",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v4/*: any*/),
                      (v5/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "type",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "dataType",
                        "storageKey": null
                      },
                      {
                        "alias": "cardinality",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "cardinality"
                          },
                          (v6/*: any*/)
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": null
                      },
                      {
                        "alias": "percentEmpty",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "percentEmpty"
                          },
                          (v6/*: any*/)
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": null
                      },
                      {
                        "alias": "min",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "min"
                          },
                          (v6/*: any*/)
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": null
                      },
                      {
                        "alias": "mean",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "mean"
                          },
                          (v6/*: any*/)
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": null
                      },
                      {
                        "alias": "max",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "max"
                          },
                          (v6/*: any*/)
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": null
                      },
                      {
                        "alias": "psi",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "psi"
                          },
                          (v6/*: any*/)
                        ],
                        "kind": "ScalarField",
                        "name": "driftMetric",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v7/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Dimension",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": (v8/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v9/*: any*/)
            ],
            "storageKey": "dimensions(first:50)"
          },
          {
            "alias": null,
            "args": (v3/*: any*/),
            "filters": null,
            "handle": "connection",
            "key": "ModelSchemaTable_dimensions",
            "kind": "LinkedHandle",
            "name": "dimensions"
          },
          {
            "alias": null,
            "args": (v3/*: any*/),
            "concreteType": "EmbeddingDimensionConnection",
            "kind": "LinkedField",
            "name": "embeddingDimensions",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "EmbeddingDimensionEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": "embedding",
                    "args": null,
                    "concreteType": "EmbeddingDimension",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v4/*: any*/),
                      (v5/*: any*/),
                      {
                        "alias": "euclideanDistance",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "euclideanDistance"
                          },
                          (v6/*: any*/)
                        ],
                        "kind": "ScalarField",
                        "name": "driftMetric",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v7/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EmbeddingDimension",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": (v8/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v9/*: any*/)
            ],
            "storageKey": "embeddingDimensions(first:50)"
          },
          {
            "alias": null,
            "args": (v3/*: any*/),
            "filters": null,
            "handle": "connection",
            "key": "ModelEmbeddingsTable_embeddingDimensions",
            "kind": "LinkedHandle",
            "name": "embeddingDimensions"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c4ca588a9d6e4666b2fe13fb5df8520c",
    "id": null,
    "metadata": {},
    "name": "ModelPageQuery",
    "operationKind": "query",
    "text": "query ModelPageQuery(\n  $startTime: DateTime!\n  $endTime: DateTime!\n) {\n  ...ModelSchemaTable_dimensions_3uKjWt\n  ...ModelEmbeddingsTable_embeddingDimensions_3uKjWt\n}\n\nfragment ModelEmbeddingsTable_embeddingDimensions_3uKjWt on Query {\n  model {\n    embeddingDimensions(first: 50) {\n      edges {\n        embedding: node {\n          id\n          name\n          euclideanDistance: driftMetric(metric: euclideanDistance, timeRange: {start: $startTime, end: $endTime})\n        }\n        cursor\n        node {\n          __typename\n          id\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}\n\nfragment ModelSchemaTable_dimensions_3uKjWt on Query {\n  model {\n    dimensions(first: 50) {\n      edges {\n        dimension: node {\n          id\n          name\n          type\n          dataType\n          cardinality: dataQualityMetric(metric: cardinality, timeRange: {start: $startTime, end: $endTime})\n          percentEmpty: dataQualityMetric(metric: percentEmpty, timeRange: {start: $startTime, end: $endTime})\n          min: dataQualityMetric(metric: min, timeRange: {start: $startTime, end: $endTime})\n          mean: dataQualityMetric(metric: mean, timeRange: {start: $startTime, end: $endTime})\n          max: dataQualityMetric(metric: max, timeRange: {start: $startTime, end: $endTime})\n          psi: driftMetric(metric: psi, timeRange: {start: $startTime, end: $endTime})\n        }\n        cursor\n        node {\n          __typename\n          id\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b612239336c7638df42037315b00f635";

export default node;
