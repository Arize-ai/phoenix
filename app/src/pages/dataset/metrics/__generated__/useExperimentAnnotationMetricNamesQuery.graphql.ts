/**
 * @generated SignedSource<<bc95ed1905bfa4607debc5da0df54698>>
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
    readonly experimentAnnotationSummaries?: ReadonlyArray<{
      readonly annotationName: string;
    }>;
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
      "concreteType": "DatasetExperimentAnnotationSummary",
      "kind": "LinkedField",
      "name": "experimentAnnotationSummaries",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "annotationName",
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
    "cacheID": "39a624c4acfd232a4879207556d7e028",
    "id": null,
    "metadata": {},
    "name": "useExperimentAnnotationMetricNamesQuery",
    "operationKind": "query",
    "text": "query useExperimentAnnotationMetricNamesQuery(\n  $id: ID!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      experimentAnnotationSummaries {\n        annotationName\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "530a2f745f6b18f58d8cb5024cbc51ef";

export default node;
