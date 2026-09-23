/**
 * @generated SignedSource<<27469701208536822d43eaf14c763d00>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentRunFilterConditionFieldCompletionsQuery$variables = {
  id: string;
};
export type ExperimentRunFilterConditionFieldCompletionsQuery$data = {
  readonly experiment: {
    readonly annotationSummaries?: ReadonlyArray<{
      readonly annotationName: string;
    }>;
  };
};
export type ExperimentRunFilterConditionFieldCompletionsQuery = {
  response: ExperimentRunFilterConditionFieldCompletionsQuery$data;
  variables: ExperimentRunFilterConditionFieldCompletionsQuery$variables;
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
      "concreteType": "ExperimentAnnotationSummary",
      "kind": "LinkedField",
      "name": "annotationSummaries",
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
  "type": "Experiment",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentRunFilterConditionFieldCompletionsQuery",
    "selections": [
      {
        "alias": "experiment",
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
    "name": "ExperimentRunFilterConditionFieldCompletionsQuery",
    "selections": [
      {
        "alias": "experiment",
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
    "cacheID": "a4e88a9e607dd5e87a6f53b0da4f4334",
    "id": null,
    "metadata": {},
    "name": "ExperimentRunFilterConditionFieldCompletionsQuery",
    "operationKind": "query",
    "text": "query ExperimentRunFilterConditionFieldCompletionsQuery(\n  $id: ID!\n) {\n  experiment: node(id: $id) {\n    __typename\n    ... on Experiment {\n      annotationSummaries {\n        annotationName\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "44b858450e9e9b82f26444c2ca9bced9";

export default node;
