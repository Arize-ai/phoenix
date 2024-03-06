/**
 * @generated SignedSource<<62516cb9f93f0d9d71df1831613fd731>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DocumentEvaluationSummaryQuery$variables = {
  evaluationName: string;
};
export type DocumentEvaluationSummaryQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DocumentEvaluationSummaryValueFragment">;
};
export type DocumentEvaluationSummaryQuery = {
  response: DocumentEvaluationSummaryQuery$data;
  variables: DocumentEvaluationSummaryQuery$variables;
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
    "name": "DocumentEvaluationSummaryQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "DocumentEvaluationSummaryValueFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DocumentEvaluationSummaryQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DocumentEvaluationSummary",
        "kind": "LinkedField",
        "name": "documentEvaluationSummary",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "averageNdcg",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "averagePrecision",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "meanReciprocalRank",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "hitRate",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "128887370326e6f31e211ff48094572a",
    "id": null,
    "metadata": {},
    "name": "DocumentEvaluationSummaryQuery",
    "operationKind": "query",
    "text": "query DocumentEvaluationSummaryQuery(\n  $evaluationName: String!\n) {\n  ...DocumentEvaluationSummaryValueFragment_qsFcK\n}\n\nfragment DocumentEvaluationSummaryValueFragment_qsFcK on Query {\n  documentEvaluationSummary(evaluationName: $evaluationName) {\n    averageNdcg\n    averagePrecision\n    meanReciprocalRank\n    hitRate\n  }\n}\n"
  }
};
})();

(node as any).hash = "bf75586dafc4a88ba9529c86783e3933";

export default node;
