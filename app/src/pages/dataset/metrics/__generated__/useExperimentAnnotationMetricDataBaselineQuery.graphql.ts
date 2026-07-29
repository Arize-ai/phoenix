/**
 * @generated SignedSource<<b00cb51c302db986c097f9534fe34976>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useExperimentAnnotationMetricDataBaselineQuery$variables = {
  id: string;
};
export type useExperimentAnnotationMetricDataBaselineQuery$data = {
  readonly dataset: {
    readonly baselineExperiment?: {
      readonly id: string;
    } | null;
  };
};
export type useExperimentAnnotationMetricDataBaselineQuery = {
  response: useExperimentAnnotationMetricDataBaselineQuery$data;
  variables: useExperimentAnnotationMetricDataBaselineQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Experiment",
      "kind": "LinkedField",
      "name": "baselineExperiment",
      "plural": false,
      "selections": [
        (v2/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useExperimentAnnotationMetricDataBaselineQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useExperimentAnnotationMetricDataBaselineQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
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
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "fb123fbea7d1ff6b95b5138fcafbd6df",
    "id": null,
    "metadata": {},
    "name": "useExperimentAnnotationMetricDataBaselineQuery",
    "operationKind": "query",
    "text": "query useExperimentAnnotationMetricDataBaselineQuery(\n  $id: ID!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      baselineExperiment {\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f633b8994ad2a4833b8531c21ee860a6";

export default node;
