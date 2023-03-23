/**
 * @generated SignedSource<<8ff06300b7ab497c3e9147f837c24fe7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type HomeQuery$variables = {
  endTime: string;
  startTime: string;
};
export type HomeQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ModelEmbeddingsTable_embeddingDimensions" | "ModelSchemaTable_dimensions">;
};
export type HomeQuery = {
  response: HomeQuery$data;
  variables: HomeQuery$variables;
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
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v5 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "__typename",
    "storageKey": null
  }
],
v6 = {
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
    "name": "HomeQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ModelSchemaTable_dimensions"
      },
      {
        "args": [
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
    "name": "HomeQuery",
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
            "args": (v2/*: any*/),
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
                      (v3/*: any*/),
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
                          }
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": "dataQualityMetric(metric:\"cardinality\")"
                      },
                      {
                        "alias": "percentEmpty",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "percentEmpty"
                          }
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": "dataQualityMetric(metric:\"percentEmpty\")"
                      },
                      {
                        "alias": "min",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "min"
                          }
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": "dataQualityMetric(metric:\"min\")"
                      },
                      {
                        "alias": "mean",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "mean"
                          }
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": "dataQualityMetric(metric:\"mean\")"
                      },
                      {
                        "alias": "max",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "max"
                          }
                        ],
                        "kind": "ScalarField",
                        "name": "dataQualityMetric",
                        "storageKey": "dataQualityMetric(metric:\"max\")"
                      },
                      {
                        "alias": "psi",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "psi"
                          }
                        ],
                        "kind": "ScalarField",
                        "name": "driftMetric",
                        "storageKey": "driftMetric(metric:\"psi\")"
                      }
                    ],
                    "storageKey": null
                  },
                  (v4/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Dimension",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": (v5/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v6/*: any*/)
            ],
            "storageKey": "dimensions(first:50)"
          },
          {
            "alias": null,
            "args": (v2/*: any*/),
            "filters": null,
            "handle": "connection",
            "key": "ModelSchemaTable_dimensions",
            "kind": "LinkedHandle",
            "name": "dimensions"
          },
          {
            "alias": null,
            "args": (v2/*: any*/),
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
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "id",
                        "storageKey": null
                      },
                      (v3/*: any*/),
                      {
                        "alias": "euclideanDistance",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "metric",
                            "value": "euclideanDistance"
                          },
                          {
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
                          }
                        ],
                        "kind": "ScalarField",
                        "name": "driftMetric",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v4/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EmbeddingDimension",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": (v5/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v6/*: any*/)
            ],
            "storageKey": "embeddingDimensions(first:50)"
          },
          {
            "alias": null,
            "args": (v2/*: any*/),
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
    "cacheID": "8d9e575414b81758ceaa7e13fa05e700",
    "id": null,
    "metadata": {},
    "name": "HomeQuery",
    "operationKind": "query",
    "text": "query HomeQuery(\n  $startTime: DateTime!\n  $endTime: DateTime!\n) {\n  ...ModelSchemaTable_dimensions\n  ...ModelEmbeddingsTable_embeddingDimensions_3uKjWt\n}\n\nfragment ModelEmbeddingsTable_embeddingDimensions_3uKjWt on Query {\n  model {\n    embeddingDimensions(first: 50) {\n      edges {\n        embedding: node {\n          id\n          name\n          euclideanDistance: driftMetric(metric: euclideanDistance, timeRange: {start: $startTime, end: $endTime})\n        }\n        cursor\n        node {\n          __typename\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}\n\nfragment ModelSchemaTable_dimensions on Query {\n  model {\n    dimensions(first: 50) {\n      edges {\n        dimension: node {\n          name\n          type\n          dataType\n          cardinality: dataQualityMetric(metric: cardinality)\n          percentEmpty: dataQualityMetric(metric: percentEmpty)\n          min: dataQualityMetric(metric: min)\n          mean: dataQualityMetric(metric: mean)\n          max: dataQualityMetric(metric: max)\n          psi: driftMetric(metric: psi)\n        }\n        cursor\n        node {\n          __typename\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b18291d9164589c5a8afcc4d0a676ea0";

export default node;
