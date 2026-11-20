/**
 * @generated SignedSource<<7b65385baa5bcaa9e62e236b601424ed>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearQueuedEvaluationsMenuAllCountsQuery$variables = Record<PropertyKey, never>;
export type ClearQueuedEvaluationsMenuAllCountsQuery$data = {
  readonly evaluationQueue: {
    readonly queuedCount: number;
    readonly runningCount: number;
  };
};
export type ClearQueuedEvaluationsMenuAllCountsQuery = {
  response: ClearQueuedEvaluationsMenuAllCountsQuery$data;
  variables: ClearQueuedEvaluationsMenuAllCountsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "EvaluationQueue",
    "kind": "LinkedField",
    "name": "evaluationQueue",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "queuedCount",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "runningCount",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ClearQueuedEvaluationsMenuAllCountsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ClearQueuedEvaluationsMenuAllCountsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "a42c6d289773324770619b523e718769",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsMenuAllCountsQuery",
    "operationKind": "query",
    "text": "query ClearQueuedEvaluationsMenuAllCountsQuery {\n  evaluationQueue {\n    queuedCount\n    runningCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "aaeac75d1a592629559362883391cf2e";

export default node;
