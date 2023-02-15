/**
 * @generated SignedSource<<9a09a4a523236f3fd464b5122a2ccf66>>
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
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = [
  (v2/*: any*/),
  {
    "alias": null,
    "args": null,
    "concreteType": "TimeSeriesDataPoint",
    "kind": "LinkedField",
    "name": "data",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "value",
        "storageKey": null
      }
    ],
    "storageKey": null
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
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "dataQualityMetric",
                        "plural": false,
                        "selections": (v3/*: any*/),
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
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "dataQualityMetric",
                        "plural": false,
                        "selections": (v3/*: any*/),
                        "storageKey": "dataQualityMetric(metric:\"percentEmpty\")"
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
                      (v2/*: any*/)
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
    "cacheID": "7ff10bc34a0e6d130acdaaade42dd509",
    "id": null,
    "metadata": {},
    "name": "ModelSchemaTableDimensionsQuery",
    "operationKind": "query",
    "text": "query ModelSchemaTableDimensionsQuery(\n  $count: Int = 50\n  $cursor: String = null\n) {\n  ...ModelSchemaTable_dimensions_1G22uz\n}\n\nfragment ModelSchemaTable_dimensions_1G22uz on Query {\n  model {\n    dimensions(first: $count, after: $cursor) {\n      edges {\n        dimension: node {\n          name\n          type\n          dataType\n          cardinality: dataQualityMetric(metric: cardinality) {\n            __typename\n            data {\n              value\n            }\n          }\n          percentEmpty: dataQualityMetric(metric: percentEmpty) {\n            __typename\n            data {\n              value\n            }\n          }\n        }\n        cursor\n        node {\n          __typename\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "29bdc592a4251c07d7e67721f239fb7e";

export default node;
