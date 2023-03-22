/**
 * @generated SignedSource<<67d2a2d6ce2e5b9a3c303e34711c7945>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelSchemaTableDimensionsQuery$variables = {
  count?: number | null;
  cursor?: string | null;
};
export type ModelSchemaTableDimensionsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ModelSchemaTable_dimensions">;
};
export type ModelSchemaTableDimensionsQuery = {
  response: ModelSchemaTableDimensionsQuery$data;
  variables: ModelSchemaTableDimensionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": 50,
    "kind": "LocalArgument",
    "name": "count"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "cursor"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "cursor"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "count"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ModelSchemaTableDimensionsQuery",
    "selections": [
      {
        "args": [
          {
            "kind": "Variable",
            "name": "count",
            "variableName": "count"
          },
          {
            "kind": "Variable",
            "name": "cursor",
            "variableName": "cursor"
          }
        ],
        "kind": "FragmentSpread",
        "name": "ModelSchemaTable_dimensions"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ModelSchemaTableDimensionsQuery",
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
            "args": (v1/*: any*/),
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
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "name",
                        "storageKey": null
                      },
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
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cursor",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Dimension",
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
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": (v1/*: any*/),
            "filters": null,
            "handle": "connection",
            "key": "ModelSchemaTable_dimensions",
            "kind": "LinkedHandle",
            "name": "dimensions"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "130f5223ad19b1d70aa342925868739a",
    "id": null,
    "metadata": {},
    "name": "ModelSchemaTableDimensionsQuery",
    "operationKind": "query",
    "text": "query ModelSchemaTableDimensionsQuery(\n  $count: Int = 50\n  $cursor: String = null\n) {\n  ...ModelSchemaTable_dimensions_1G22uz\n}\n\nfragment ModelSchemaTable_dimensions_1G22uz on Query {\n  model {\n    dimensions(first: $count, after: $cursor) {\n      edges {\n        dimension: node {\n          name\n          type\n          dataType\n          cardinality: dataQualityMetric(metric: cardinality)\n          percentEmpty: dataQualityMetric(metric: percentEmpty)\n          min: dataQualityMetric(metric: min)\n          mean: dataQualityMetric(metric: mean)\n          max: dataQualityMetric(metric: max)\n          psi: driftMetric(metric: psi)\n        }\n        cursor\n        node {\n          __typename\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fdbee9f78e795b25c75649dfb377701a";

export default node;
