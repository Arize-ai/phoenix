/**
 * @generated SignedSource<<77c2e6fe207e12a47ebcc1659dce47d8>>
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
  endTime: string;
  startTime: string;
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
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "endTime"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "startTime"
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
],
v2 = {
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
};
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
          },
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
                          },
                          (v2/*: any*/)
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
                          (v2/*: any*/)
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
                          (v2/*: any*/)
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
                          (v2/*: any*/)
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
                          (v2/*: any*/)
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
                          (v2/*: any*/)
                        ],
                        "kind": "ScalarField",
                        "name": "driftMetric",
                        "storageKey": null
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
    "cacheID": "5f2023d1fd6cd193a0930840f1490f4a",
    "id": null,
    "metadata": {},
    "name": "ModelSchemaTableDimensionsQuery",
    "operationKind": "query",
    "text": "query ModelSchemaTableDimensionsQuery(\n  $count: Int = 50\n  $cursor: String = null\n  $endTime: DateTime!\n  $startTime: DateTime!\n) {\n  ...ModelSchemaTable_dimensions_4sIU9C\n}\n\nfragment ModelSchemaTable_dimensions_4sIU9C on Query {\n  model {\n    dimensions(first: $count, after: $cursor) {\n      edges {\n        dimension: node {\n          name\n          type\n          dataType\n          cardinality: dataQualityMetric(metric: cardinality, timeRange: {start: $startTime, end: $endTime})\n          percentEmpty: dataQualityMetric(metric: percentEmpty, timeRange: {start: $startTime, end: $endTime})\n          min: dataQualityMetric(metric: min, timeRange: {start: $startTime, end: $endTime})\n          mean: dataQualityMetric(metric: mean, timeRange: {start: $startTime, end: $endTime})\n          max: dataQualityMetric(metric: max, timeRange: {start: $startTime, end: $endTime})\n          psi: driftMetric(metric: psi, timeRange: {start: $startTime, end: $endTime})\n        }\n        cursor\n        node {\n          __typename\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "567dde6bbe888ee7145eccaa57766d2b";

export default node;
