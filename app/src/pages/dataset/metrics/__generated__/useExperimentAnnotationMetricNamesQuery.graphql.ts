/**
 * @generated SignedSource<<df5bfc67024d9de6dd20e15aa6f72d12>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useExperimentAnnotationMetricNamesQuery$variables = {
  count: number;
  id: string;
};
export type useExperimentAnnotationMetricNamesQuery$data = {
  readonly dataset: {
    readonly experimentAnnotationMetrics?: {
      readonly names: ReadonlyArray<string>;
    };
  };
};
export type useExperimentAnnotationMetricNamesQuery = {
  response: useExperimentAnnotationMetricNamesQuery$data;
  variables: useExperimentAnnotationMetricNamesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "count"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "first",
          "variableName": "count"
        }
      ],
      "concreteType": "ExperimentAnnotationMetrics",
      "kind": "LinkedField",
      "name": "experimentAnnotationMetrics",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "names",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useExperimentAnnotationMetricNamesQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "useExperimentAnnotationMetricNamesQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
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
          },
          (v3/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7f6cf36aebb68cfbcc916bf04a71d54a",
    "id": null,
    "metadata": {},
    "name": "useExperimentAnnotationMetricNamesQuery",
    "operationKind": "query",
    "text": "query useExperimentAnnotationMetricNamesQuery(\n  $id: ID!\n  $count: Int!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      experimentAnnotationMetrics(first: $count) {\n        names\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "4fc202e80f8e7f13435dbca51d03e542";

export default node;
