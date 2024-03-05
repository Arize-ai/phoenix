/**
 * @generated SignedSource<<33b65373fad2702f250e54315b3fb51c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DocumentEvaluationSummaryValueQuery$variables = {
  evaluationName: string;
};
export type DocumentEvaluationSummaryValueQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DocumentEvaluationSummaryValueFragment">;
};
export type DocumentEvaluationSummaryValueQuery = {
  response: DocumentEvaluationSummaryValueQuery$data;
  variables: DocumentEvaluationSummaryValueQuery$variables;
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
    "name": "DocumentEvaluationSummaryValueQuery",
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
    "name": "DocumentEvaluationSummaryValueQuery",
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
    "cacheID": "79dc69d99e298401be94245f1e607353",
    "id": null,
    "metadata": {},
    "name": "DocumentEvaluationSummaryValueQuery",
    "operationKind": "query",
    "text": "query DocumentEvaluationSummaryValueQuery(\n  $evaluationName: String!\n) {\n  ...DocumentEvaluationSummaryValueFragment_qsFcK\n}\n\nfragment DocumentEvaluationSummaryValueFragment_qsFcK on Query {\n  documentEvaluationSummary(evaluationName: $evaluationName) {\n    averageNdcg\n    averagePrecision\n    meanReciprocalRank\n    hitRate\n  }\n}\n"
  }
};
})();

(node as any).hash = "2713c6e621dbac0dec917c29a08fff7b";

export default node;
