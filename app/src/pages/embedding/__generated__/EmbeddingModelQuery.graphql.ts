/**
 * @generated SignedSource<<7823b4d24614075846f36a3974064f5e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EmbeddingModelQuery$variables = {};
export type EmbeddingModelQuery$data = {
  readonly model: {
    readonly " $fragmentSpreads": FragmentRefs<"MetricSelector_dimensions">;
  };
};
export type EmbeddingModelQuery = {
  response: EmbeddingModelQuery$data;
  variables: EmbeddingModelQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "EmbeddingModelQuery",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "MetricSelector_dimensions"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "EmbeddingModelQuery",
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
            "alias": "numericDimensions",
            "args": [
              {
                "kind": "Literal",
                "name": "include",
                "value": {
                  "dataTypes": [
                    "numeric"
                  ]
                }
              }
            ],
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
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "type",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "dimensions(include:{\"dataTypes\":[\"numeric\"]})"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "05023ec3c1147ff161733abb93ec920c",
    "id": null,
    "metadata": {},
    "name": "EmbeddingModelQuery",
    "operationKind": "query",
    "text": "query EmbeddingModelQuery {\n  model {\n    ...MetricSelector_dimensions\n  }\n}\n\nfragment MetricSelector_dimensions on Model {\n  numericDimensions: dimensions(include: {dataTypes: [numeric]}) {\n    edges {\n      node {\n        id\n        name\n        type\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "3134ffb4584e7b36c503ed5b6bf5e817";

export default node;
