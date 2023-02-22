/**
 * @generated SignedSource<<c9370eeb454da237dc29644b01e92f4d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelEmbeddingsTableEmbeddingDimensionsQuery$variables = {
  count?: number | null;
  cursor?: string | null;
  endTime: string;
  startTime: string;
};
export type ModelEmbeddingsTableEmbeddingDimensionsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ModelEmbeddingsTable_embeddingDimensions">;
};
export type ModelEmbeddingsTableEmbeddingDimensionsQuery = {
  response: ModelEmbeddingsTableEmbeddingDimensionsQuery$data;
  variables: ModelEmbeddingsTableEmbeddingDimensionsQuery$variables;
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ModelEmbeddingsTableEmbeddingDimensionsQuery",
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
        "name": "ModelEmbeddingsTable_embeddingDimensions"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ModelEmbeddingsTableEmbeddingDimensionsQuery",
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
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "name",
                        "storageKey": null
                      },
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
                    "concreteType": "EmbeddingDimension",
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
    "cacheID": "d0057a41a1d9795383a58de89e72ad76",
    "id": null,
    "metadata": {},
    "name": "ModelEmbeddingsTableEmbeddingDimensionsQuery",
    "operationKind": "query",
    "text": "query ModelEmbeddingsTableEmbeddingDimensionsQuery(\n  $count: Int = 50\n  $cursor: String = null\n  $endTime: DateTime!\n  $startTime: DateTime!\n) {\n  ...ModelEmbeddingsTable_embeddingDimensions_4sIU9C\n}\n\nfragment ModelEmbeddingsTable_embeddingDimensions_4sIU9C on Query {\n  model {\n    embeddingDimensions(first: $count, after: $cursor) {\n      edges {\n        embedding: node {\n          id\n          name\n          euclideanDistance: driftMetric(metric: euclideanDistance, timeRange: {start: $startTime, end: $endTime})\n        }\n        cursor\n        node {\n          __typename\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fb7f125f75d1d33a555c16e198dbcbf8";

export default node;
