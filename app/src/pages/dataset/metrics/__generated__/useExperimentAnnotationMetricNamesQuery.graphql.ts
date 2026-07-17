/**
 * @generated SignedSource<<d57c544dd88e81cbbdd380ad3c927cd2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useExperimentAnnotationMetricNamesQuery$variables = {
  id: string;
};
export type useExperimentAnnotationMetricNamesQuery$data = {
  readonly dataset: {
    readonly experimentAnnotationNames?: ReadonlyArray<string>;
  };
};
export type useExperimentAnnotationMetricNamesQuery = {
  response: useExperimentAnnotationMetricNamesQuery$data;
  variables: useExperimentAnnotationMetricNamesQuery$variables;
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "experimentAnnotationNames",
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
    "name": "useExperimentAnnotationMetricNamesQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
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
    "name": "useExperimentAnnotationMetricNamesQuery",
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
          (v2/*:: as any*/),
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
    "cacheID": "a065f45cf5c1011575224df029a61b1a",
    "id": null,
    "metadata": {},
    "name": "useExperimentAnnotationMetricNamesQuery",
    "operationKind": "query",
    "text": "query useExperimentAnnotationMetricNamesQuery(\n  $id: ID!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      experimentAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "34e654a7fbdde06771cccd062a1f1332";

export default node;
