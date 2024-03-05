/**
 * @generated SignedSource<<925c853cb634d78c635205be5b08c41d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluationSummaryQuery$variables = {
  evaluationName: string;
};
export type EvaluationSummaryQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"EvaluationSummaryValueFragment">;
};
export type EvaluationSummaryQuery = {
  response: EvaluationSummaryQuery$data;
  variables: EvaluationSummaryQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "evaluationName"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "evaluationName",
    "variableName": "evaluationName"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluationSummaryQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "EvaluationSummaryValueFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EvaluationSummaryQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "EvaluationSummary",
        "kind": "LinkedField",
        "name": "spanEvaluationSummary",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "LabelFraction",
            "kind": "LinkedField",
            "name": "labelFractions",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "label",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "fraction",
                "storageKey": null
              }
            ],
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
    ]
  },
  "params": {
    "cacheID": "cb8452f8a7f5755f6b74f6e7eab3f3ae",
    "id": null,
    "metadata": {},
    "name": "EvaluationSummaryQuery",
    "operationKind": "query",
    "text": "query EvaluationSummaryQuery(\n  $evaluationName: String!\n) {\n  ...EvaluationSummaryValueFragment_qsFcK\n}\n\nfragment EvaluationSummaryValueFragment_qsFcK on Query {\n  spanEvaluationSummary(evaluationName: $evaluationName) {\n    labelFractions {\n      label\n      fraction\n    }\n    meanScore\n  }\n}\n"
  }
};
})();

(node as any).hash = "0510c60cd850ebf4eeed37e113108328";

export default node;
