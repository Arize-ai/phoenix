/**
 * @generated SignedSource<<86160d1ccd22334b432fcd8fe8b910dd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentAnnotationAggregatesQuery$variables = {
  experimentId: string;
};
export type ExperimentAnnotationAggregatesQuery$data = {
  readonly experiment: {
    readonly __typename: "Experiment";
    readonly annotationSummaries: ReadonlyArray<{
      readonly annotationName: string;
      readonly meanScore: number | null;
    }>;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type ExperimentAnnotationAggregatesQuery = {
  response: ExperimentAnnotationAggregatesQuery$data;
  variables: ExperimentAnnotationAggregatesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "experimentId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "meanScore",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentAnnotationAggregatesQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentAnnotationAggregatesQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
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
    "cacheID": "134fd61002bd4e33bd86afd2f06d2273",
    "id": null,
    "metadata": {},
    "name": "ExperimentAnnotationAggregatesQuery",
    "operationKind": "query",
    "text": "query ExperimentAnnotationAggregatesQuery(\n  $experimentId: ID!\n) {\n  experiment: node(id: $experimentId) {\n    __typename\n    ... on Experiment {\n      annotationSummaries {\n        annotationName\n        meanScore\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "ab5ed2b67a338faf44dde631fc4ef186";

export default node;
