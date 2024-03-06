/**
 * @generated SignedSource<<62f5fd32349c04f1ffba3460fc0670ce>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluationSummaryValueQuery$variables = {
  evaluationName: string;
};
export type EvaluationSummaryValueQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"EvaluationSummaryValueFragment">;
};
export type EvaluationSummaryValueQuery = {
  response: EvaluationSummaryValueQuery$data;
  variables: EvaluationSummaryValueQuery$variables;
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
    "name": "EvaluationSummaryValueQuery",
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
    "name": "EvaluationSummaryValueQuery",
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
    "cacheID": "d00b543e90ed3ac9800b3fa441e1c496",
    "id": null,
    "metadata": {},
    "name": "EvaluationSummaryValueQuery",
    "operationKind": "query",
    "text": "query EvaluationSummaryValueQuery(\n  $evaluationName: String!\n) {\n  ...EvaluationSummaryValueFragment_qsFcK\n}\n\nfragment EvaluationSummaryValueFragment_qsFcK on Query {\n  spanEvaluationSummary(evaluationName: $evaluationName) {\n    labelFractions {\n      label\n      fraction\n    }\n    meanScore\n  }\n}\n"
  }
};
})();

(node as any).hash = "f014d6fd36312661220d2f080f257f1d";

export default node;
